import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageBroker } from '../transport/message-broker';

/**
 * 订单服务（写模型 + 事务性 outbox）。
 *
 * 关键点：订单和 outbox 记录在同一个「数据库事务」里写入（这里是同一个同步块），
 * 事务提交成功后才投递消息。这样不会出现「订单回滚了但消息已经发出去」，
 * 也不会出现「订单成功但消息丢了」—— 消息至少存在于 outbox 表里，可重投。
 * 真实项目由 outbox relay 轮询 pending 记录或订阅数据库 CDC 来投递。
 */

export interface Order {
  id: number;
  sku: string;
  qty: number;
  amount: number;
  createdAt: string;
}

export interface OutboxEntry {
  id: number;
  topic: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent';
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

@Injectable()
export class OutboxService {
  private readonly entries: OutboxEntry[] = [];
  private nextId = 1;

  constructor(private readonly broker: MessageBroker) {}

  /** 在业务事务内调用：只写本地表，不碰网络。 */
  append(topic: string, payload: Record<string, unknown>): OutboxEntry {
    const entry: OutboxEntry = {
      id: this.nextId,
      topic,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      sentAt: null,
    };
    this.nextId += 1;
    this.entries.push(entry);
    return entry;
  }

  /** 事务提交之后调用：把 pending 的 outbox 记录投递到消息代理。 */
  dispatch(): { dispatched: number; pending: number } {
    let dispatched = 0;
    for (const entry of this.entries) {
      if (entry.status !== 'pending') continue;
      entry.attempts += 1;
      // 真实项目要等 broker/Kafka 的 ack 才标记 sent；失败则保持 pending 并重试。
      this.broker.emit(entry.topic, entry.payload);
      entry.status = 'sent';
      entry.sentAt = new Date().toISOString();
      dispatched += 1;
    }
    return {
      dispatched,
      pending: this.entries.filter((entry) => entry.status === 'pending').length,
    };
  }

  list(): OutboxEntry[] {
    return this.entries.slice().reverse();
  }
}

export interface CreateOrderInput {
  sku?: unknown;
  qty?: unknown;
  rollback?: unknown;
}

@Injectable()
export class OrderService {
  private readonly orders = new Map<number, Order>();
  private nextId = 1;

  constructor(
    private readonly outbox: OutboxService,
    private readonly broker: MessageBroker,
  ) {}

  create(input: CreateOrderInput) {
    if (input.rollback === true) {
      // 事务回滚演示：订单与 outbox 都没有提交，所以 order.created 消息不会发出。
      return {
        ok: false,
        rolledBack: true,
        published: false,
        note: '模拟数据库事务回滚：订单与 outbox 记录都不落库，消息自然不会发出（这就是一致性）',
      };
    }
    const sku = typeof input.sku === 'string' && input.sku.trim() !== '' ? input.sku.trim() : 'SKU-001';
    const qty = input.qty === undefined ? 1 : Number(input.qty);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new BadRequestException('qty 必须是正整数');
    }
    const order: Order = {
      id: this.nextId,
      sku,
      qty,
      amount: Number((19.9 * qty).toFixed(2)),
      createdAt: new Date().toISOString(),
    };
    this.nextId += 1;

    // ===== 同一个事务：写订单 + 写 outbox =====
    this.orders.set(order.id, order);
    const outboxEntry = this.outbox.append('order.created', {
      orderId: order.id,
      sku: order.sku,
      amount: order.amount,
      createdAt: order.createdAt,
    });
    // ===== 事务提交，下面才开始投递 =====
    const dispatch = this.outbox.dispatch();

    return {
      ok: true,
      rolledBack: false,
      order,
      outboxEntry,
      dispatch,
      note: '事务已提交；order.created 用 emit 投递（发后不管，不阻塞下单响应）',
    };
  }

  list(): Order[] {
    return Array.from(this.orders.values()).sort((a, b) => a.id - b.id);
  }
}
