import { Global, Injectable, Module } from '@nestjs/common';

/**
 * 单进程版消息代理（等价 @nestjs/microservices 的 Broker/Transport）。
 *
 * 真实项目：
 *   - ClientsModule.register([{ name: 'NOTIFY', transport: Transport.KAFKA, ... }])；
 *   - 订单服务注入 ClientProxy，用 client.emit('order.created', payload) 发事件，
 *     用 client.send('order.query', payload) 做请求-响应；
 *   - 通知服务用 @EventPattern('order.created') / @MessagePattern('order.query') 消费。
 * 本文件用内存注册表复刻这两个语义，并用死信队列模拟「消费失败的消息不丢」。
 */

export interface TransportMessage {
  id: string;
  pattern: string;
  payload: Record<string, unknown>;
  kind: 'send' | 'emit';
  publishedAt: string;
}

export interface DeadLetter {
  message: TransportMessage;
  error: string;
  receivedAt: string;
}

export type MessageHandler = (
  payload: Record<string, unknown>,
  message: TransportMessage,
) => unknown | Promise<unknown>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class MessageBroker {
  private readonly handlers = new Map<string, MessageHandler[]>();
  private readonly published: TransportMessage[] = [];
  private readonly pending = new Set<Promise<void>>();
  private readonly deadLetters: DeadLetter[] = [];
  private sequence = 0;

  register(pattern: string, handler: MessageHandler): void {
    const list = this.handlers.get(pattern) ?? [];
    list.push(handler);
    this.handlers.set(pattern, list);
  }

  patterns(): string[] {
    return Array.from(this.handlers.keys()).sort();
  }

  /** 等价 ClientProxy.send：请求-响应，调用方等待消费者返回值。 */
  async send<T = unknown>(pattern: string, payload: Record<string, unknown> = {}): Promise<T> {
    const message = this.createMessage(pattern, payload, 'send');
    this.published.push(message);
    const list = this.handlers.get(pattern) ?? [];
    if (list.length === 0) throw new Error('没有消费者处理 ' + pattern + '（真实项目会由服务发现拒绝路由）');
    return (await list[0](message.payload, message)) as T;
  }

  /** 等价 ClientProxy.emit：发后不管，消费失败只进死信，不阻塞发布方。 */
  emit(pattern: string, payload: Record<string, unknown> = {}): void {
    const message = this.createMessage(pattern, payload, 'emit');
    this.published.push(message);
    const list = this.handlers.get(pattern) ?? [];
    if (list.length === 0) {
      this.deadLetters.push({ message, error: '没有消费者处理 ' + pattern, receivedAt: new Date().toISOString() });
      return;
    }
    for (const handler of list) {
      const task = (async () => {
        try {
          await handler(message.payload, message);
        } catch (error) {
          this.deadLetters.push({
            message,
            error: errorMessage(error),
            receivedAt: new Date().toISOString(),
          });
        }
      })();
      this.pending.add(task);
      void task.finally(() => {
        this.pending.delete(task);
      });
    }
  }

  /** 等待所有 emit 出来的消费任务结束（真实项目靠消息确认，不靠这个）。 */
  async settled(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all(Array.from(this.pending));
    }
  }

  recentPublished(limit = 20): TransportMessage[] {
    return this.published.slice(-limit).reverse();
  }

  deadLetterSnapshot(): DeadLetter[] {
    return this.deadLetters.slice().reverse();
  }

  stats() {
    return {
      published: this.published.length,
      pendingConsumers: this.pending.size,
      deadLetters: this.deadLetters.length,
      patterns: this.patterns(),
    };
  }

  private createMessage(
    pattern: string,
    payload: Record<string, unknown>,
    kind: 'send' | 'emit',
  ): TransportMessage {
    this.sequence += 1;
    return {
      id: 'msg-' + this.sequence,
      pattern,
      payload,
      kind,
      publishedAt: new Date().toISOString(),
    };
  }
}

/** 全局模块：等价真实项目里 ClientsModule 在基础设施层的注册。 */
@Global()
@Module({
  providers: [MessageBroker],
  exports: [MessageBroker],
})
export class TransportModule {}
