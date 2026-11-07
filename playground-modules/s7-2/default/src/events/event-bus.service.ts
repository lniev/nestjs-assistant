import { Injectable } from '@nestjs/common';

/**
 * 手写事件总线（等价 @nestjs/event-emitter + EventEmitter2）。
 *
 * 关键语义（和真实库一致）：
 *   - emit 是「同步发布」：监听器在发布方线程里依次执行，单个监听器抛错只影响
 *     它自己，然后继续执行下一个监听器 —— 所以「通知失败不能拖垮下单」；
 *   - emitAsync 会等待所有监听器完成并收集错误，等价 @OnEvent({ async: true })；
 *   - 监听器里做重活、调外部服务时，真实项目应改为异步事件（消息队列），
 *     否则仍会拖慢请求线程。
 *
 * 真实项目里监听器用装饰器注册：
 *   @OnEvent('order.created') sendMail(event: OrderCreatedEvent) { ... }
 * 本工程在 OrderReadModel / NotificationListener 的 onModuleInit 里手动订阅。
 */

export interface DomainEvent<T = Record<string, unknown>> {
  type: string;
  payload: T;
  occurredAt: string;
}

export type EventHandler = (event: DomainEvent) => void | Promise<void>;

export interface EventLogEntry {
  type: string;
  mode: 'emit' | 'emitAsync';
  handlers: string[];
  errors: string[];
  at: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class EventBus {
  private readonly handlers = new Map<string, Array<{ name: string; handler: EventHandler }>>();
  private readonly entries: EventLogEntry[] = [];

  on(type: string, name: string, handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push({ name, handler });
    this.handlers.set(type, list);
  }

  listeners(type: string): string[] {
    return (this.handlers.get(type) ?? []).map((item) => item.name);
  }

  log(): EventLogEntry[] {
    return this.entries.slice().reverse();
  }

  /** 同步发布：监听器抛错被隔离并记录，不会向调用方冒泡（@OnEvent 默认行为）。 */
  emit(type: string, payload: Record<string, unknown>): void {
    const entry: EventLogEntry = {
      type,
      mode: 'emit',
      handlers: this.listeners(type),
      errors: [],
      at: new Date().toISOString(),
    };
    this.entries.push(entry);
    const event: DomainEvent = { type, payload, occurredAt: entry.at };
    for (const item of this.handlers.get(type) ?? []) {
      try {
        const outcome = item.handler(event);
        if (outcome !== undefined && typeof (outcome as Promise<void>).then === 'function') {
          (outcome as Promise<void>).then(undefined, (error: unknown) => {
            entry.errors.push(item.name + '：' + errorMessage(error));
          });
        }
      } catch (error) {
        entry.errors.push(item.name + '：' + errorMessage(error));
      }
    }
  }

  /** 异步发布：等待全部监听器完成，返回收集到的错误（等价 emitAsync）。 */
  async emitAsync(type: string, payload: Record<string, unknown>): Promise<{ errors: string[] }> {
    const entry: EventLogEntry = {
      type,
      mode: 'emitAsync',
      handlers: this.listeners(type),
      errors: [],
      at: new Date().toISOString(),
    };
    this.entries.push(entry);
    const event: DomainEvent = { type, payload, occurredAt: entry.at };
    for (const item of this.handlers.get(type) ?? []) {
      try {
        await item.handler(event);
      } catch (error) {
        entry.errors.push(item.name + '：' + errorMessage(error));
      }
    }
    return { errors: entry.errors };
  }
}
