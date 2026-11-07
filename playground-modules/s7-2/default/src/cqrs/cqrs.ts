import { Injectable } from '@nestjs/common';

/**
 * 手写版 CQRS 总线（等价 @nestjs/cqrs）。
 *
 * 真实项目：
 *   class CreateOrderCommand extends Command<Order> { constructor(public dto: CreateOrderDto) {} }
 *   @CommandHandler(CreateOrderCommand)
 *   class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> { execute(...) }
 *   this.commandBus.execute(new CreateOrderCommand(dto));   // 写
 *   this.queryBus.execute(new ListOrdersQuery());            // 读
 *
 * 本工程省掉装饰器扫描：用字符串 kind 注册处理器，语义完全一样 ——
 * 命令走写模型、查询走读模型，控制器只和总线打交道，不直接 new 业务服务。
 */

export interface Command {
  readonly kind: string;
  [key: string]: unknown;
}

export interface Query {
  readonly kind: string;
  [key: string]: unknown;
}

export interface HandlerRegistration<T, R> {
  kind: string;
  name: string;
  handle(input: T): R | Promise<R>;
}

@Injectable()
export class CommandBus {
  private readonly handlers = new Map<string, HandlerRegistration<any, any>>();

  register(handler: HandlerRegistration<any, any>): void {
    this.handlers.set(handler.kind, handler);
  }

  registered(): string[] {
    return Array.from(this.handlers.keys()).sort();
  }

  async execute<R = unknown>(command: Command): Promise<R> {
    const handler = this.handlers.get(command.kind);
    if (handler === undefined) throw new Error('没有注册命令处理器：' + command.kind);
    return handler.handle(command) as R;
  }
}

@Injectable()
export class QueryBus {
  private readonly handlers = new Map<string, HandlerRegistration<any, any>>();

  register(handler: HandlerRegistration<any, any>): void {
    this.handlers.set(handler.kind, handler);
  }

  registered(): string[] {
    return Array.from(this.handlers.keys()).sort();
  }

  async execute<R = unknown>(query: Query): Promise<R> {
    const handler = this.handlers.get(query.kind);
    if (handler === undefined) throw new Error('没有注册查询处理器：' + query.kind);
    return handler.handle(query) as R;
  }
}
