import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * 支付服务：用 Idempotency-Key 保证「可安全重试」。
 *
 * 真实项目：
 *   - 客户端每次发起支付都带一个唯一 Idempotency-Key（例如订单号 + UUID）；
 *   - 服务端用 Redis SET NX 或数据库唯一索引（idempotency_key 唯一）抢占；
 *   - 抢到 → 真正扣款并记录结果；没抢到 → 返回第一次的结果（或 409 让客户端轮询）；
 *   - 这样网络超时导致的重试不会重复扣款。
 *
 * 本工程用 Map 存 key → 扣款记录，演示同样语义（重启后丢失，真实实现要持久化）。
 */

export interface PaymentRecord {
  id: number;
  idempotencyKey: string;
  amount: number;
  currency: string;
  status: 'succeeded';
  chargedAt: string;
}

@Injectable()
export class PaymentsService {
  private readonly records = new Map<string, PaymentRecord>();
  private nextId = 1;

  /** charge 是幂等写操作：同一个 key 永远只产生一条扣款记录。 */
  charge(input: { amount?: unknown; idempotencyKey?: unknown }) {
    const amount = input?.amount === undefined ? 99 : Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount 必须是正数');
    }
    const rawKey = typeof input?.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
    const key = rawKey !== '' ? rawKey : 'auto:' + amount;
    const existing = this.records.get(key);
    if (existing !== undefined) {
      const totalCharged = this.sum();
      return {
        ok: true,
        replayed: true,
        payment: existing,
        totalCharged,
        note: '重复的 Idempotency-Key：直接回放第一次扣款结果，本次没有重复扣款',
      };
    }
    const payment: PaymentRecord = {
      id: this.nextId,
      idempotencyKey: key,
      amount,
      currency: 'CNY',
      status: 'succeeded',
      chargedAt: new Date().toISOString(),
    };
    this.nextId += 1;
    this.records.set(key, payment);
    return {
      ok: true,
      replayed: false,
      payment,
      totalCharged: this.sum(),
      note: '首次扣款成功；用同一个 Idempotency-Key 再请求只会回放，不会重复扣款',
    };
  }

  list(): PaymentRecord[] {
    return Array.from(this.records.values());
  }

  private sum(): number {
    return Number(
      Array.from(this.records.values())
        .reduce((total, record) => total + record.amount, 0)
        .toFixed(2),
    );
  }
}
