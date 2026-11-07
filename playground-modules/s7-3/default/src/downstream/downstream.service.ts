import { Injectable } from '@nestjs/common';
import { sleep } from '../resilience/resilience';

/**
 * 假的外部物流服务（会慢、会失败）。
 *
 * 真实的「下游」通常是 HTTP 客户端（@nestjs/axios / fetch）或 RPC。
 * 这里用一个内存服务模拟，方便在请求台里调参做故障演练：
 *   - delayMs：每次调用耗时（调大到 300ms 就能触发超时）；
 *   - failuresRemaining：接下来 N 次调用直接报错（模拟 503）。
 */

export interface DownstreamStatus {
  delayMs: number;
  failuresRemaining: number;
  calls: number;
  lastCallAt: string | null;
}

@Injectable()
export class DownstreamService {
  private delayMs = 20;
  private failuresRemaining = 0;
  private calls = 0;
  private lastCallAt: string | null = null;

  configure(input: { delayMs?: unknown; failures?: unknown }): DownstreamStatus {
    this.delayMs = Math.min(3000, Math.max(0, Number(input?.delayMs ?? this.delayMs) || 0));
    this.failuresRemaining = Math.min(10, Math.max(0, Math.round(Number(input?.failures ?? this.failuresRemaining) || 0)));
    return this.status();
  }

  reset(): DownstreamStatus {
    this.delayMs = 20;
    this.failuresRemaining = 0;
    this.calls = 0;
    this.lastCallAt = null;
    return this.status();
  }

  status(): DownstreamStatus {
    return {
      delayMs: this.delayMs,
      failuresRemaining: this.failuresRemaining,
      calls: this.calls,
      lastCallAt: this.lastCallAt,
    };
  }

  /** 查询物流报价；耗时由 delayMs 控制，可能超时或失败。 */
  async fetchQuote(orderId: number): Promise<Record<string, unknown>> {
    this.calls += 1;
    this.lastCallAt = new Date().toISOString();
    if (this.delayMs > 0) await sleep(this.delayMs);
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('物流下游返回 503（模拟故障）');
    }
    return {
      orderId,
      carrier: 'SF Express',
      etaDays: 2,
      price: 18.5,
      source: 'downstream',
      at: new Date().toISOString(),
    };
  }
}
