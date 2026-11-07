import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '../cqrs/cqrs';
import { EventBus } from '../events/event-bus.service';

/**
 * 写模型 + 读模型（CQRS 的两个半边）。
 *
 * Write 侧只负责校验并保存订单，然后把领域事件丢给 EventBus；
 * Read 侧只由 order.created 事件更新投影（projection），查询永远读投影。
 * 这样查询可以独立扩展、缓存、换存储，而不影响写路径。
 */

export interface Order {
  id: number;
  sku: string;
  qty: number;
  amount: number;
  currency: string;
  failNotification?: boolean;
  createdAt: string;
}

export interface OrderView {
  id: number;
  sku: string;
  qty: number;
  amount: number;
  status: 'created';
  projectedAt: string;
}

export interface CreateOrderCommand {
  readonly kind: 'create-order';
  sku?: string;
  qty?: number;
  failNotification?: boolean;
}

const UNIT_PRICE = 19.9;

@Injectable()
export class OrderWriteService implements OnModuleInit {
  private readonly orders = new Map<number, Order>();
  private nextId = 1;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly events: EventBus,
  ) {}

  onModuleInit(): void {
    this.commandBus.register({
      kind: 'create-order',
      name: 'CreateOrderHandler',
      handle: (command: CreateOrderCommand) => this.createOrder(command),
    });
  }

  /** 命令处理器：只做一件事 —— 校验并持久化订单，然后发布事件。 */
  createOrder(command: CreateOrderCommand): Order {
    const sku = typeof command.sku === 'string' && command.sku.trim() !== '' ? command.sku.trim() : 'SKU-001';
    const qty = command.qty === undefined ? 1 : Number(command.qty);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new BadRequestException('qty 必须是正整数');
    }
    const order: Order = {
      id: this.nextId,
      sku,
      qty,
      amount: Number((UNIT_PRICE * qty).toFixed(2)),
      currency: 'CNY',
      failNotification: command.failNotification === true,
      createdAt: new Date().toISOString(),
    };
    this.nextId += 1;
    this.orders.set(order.id, order);

    // 写模型提交之后发布事件；真实项目应用 outbox 保证「提交成功 = 事件一定发出」。
    this.events.emit('order.created', { order });
    return order;
  }

  getById(id: number): Order | undefined {
    return this.orders.get(id);
  }
}

@Injectable()
export class OrderReadModel implements OnModuleInit {
  private readonly views = new Map<number, OrderView>();

  constructor(
    private readonly events: EventBus,
    private readonly queryBus: QueryBus,
  ) {}

  onModuleInit(): void {
    // 投影只订阅事件，不直接调用写服务 —— 这就是读模型与写模型的解耦点。
    this.events.on('order.created', 'OrderProjection', (event) => {
      const order = event.payload.order as Order;
      this.views.set(order.id, {
        id: order.id,
        sku: order.sku,
        qty: order.qty,
        amount: order.amount,
        status: 'created',
        projectedAt: new Date().toISOString(),
      });
    });

    this.queryBus.register({
      kind: 'list-orders',
      name: 'ListOrdersHandler',
      handle: () => Array.from(this.views.values()).sort((a, b) => a.id - b.id),
    });
    this.queryBus.register({
      kind: 'get-order',
      name: 'GetOrderHandler',
      handle: (query: { id: number }) => {
        const view = this.views.get(Number(query.id));
        if (view === undefined) throw new NotFoundException('订单不存在：' + String(query.id));
        return view;
      },
    });
  }
}
