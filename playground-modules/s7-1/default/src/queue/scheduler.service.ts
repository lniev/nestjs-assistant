import { Injectable } from '@nestjs/common';

/**
 * 定时任务 + 内存锁（等价 @nestjs/schedule + Redlock）。
 *
 * 真实项目：
 *   - @nestjs/schedule 的 @Cron('0 2 * * *') 每天 02:00 触发对账；
 *   - 多实例部署时每个实例都会触发，所以要用 Redis 分布式锁（Redlock）
 *     或 BullMQ 的 jobId 去重，保证同一时刻只有一个执行者；
 *   - 锁一定要带 TTL（防止实例崩溃后锁永远不释放），并记录最后执行时间供告警。
 *
 * 操练场是单进程，这里用内存锁演示同样的「获取 → 执行 → 释放」流程；
 * 手动触发入口是 POST /schedule/reconcile（真实项目由 cron 调用）。
 */

interface LockRecord {
  name: string;
  owner: string;
  expiresAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as any).unref?.();
  });
}

@Injectable()
export class SchedulerService {
  private readonly locks = new Map<string, LockRecord>();
  private lastRun: { at: string; rows: number; durationMs: number; lock: string } | null = null;

  /** 尝试加锁：已存在且未过期 → 拿不到锁（说明另一个实例正在跑）。 */
  private tryAcquire(name: string, ttlMs: number): string | null {
    const now = Date.now();
    const current = this.locks.get(name);
    if (current !== undefined && current.expiresAt > now) return null;
    const owner = 'worker-' + Math.random().toString(36).slice(2, 10);
    this.locks.set(name, { name, owner, expiresAt: now + ttlMs });
    return owner;
  }

  private release(name: string, owner: string): void {
    const current = this.locks.get(name);
    if (current !== undefined && current.owner === owner) this.locks.delete(name);
  }

  /**
   * 对账任务：查昨日订单、生成差异报表。
   * holdMs 用来模拟对账耗时，便于观察锁冲突（真实项目不需要这个参数）。
   */
  async reconcile(holdMs = 0): Promise<Record<string, unknown>> {
    const ttlMs = 5000;
    const owner = this.tryAcquire('reconcile', ttlMs);
    if (owner === null) {
      return {
        ran: false,
        reason: '锁被占用：另一个实例正在执行对账，本次跳过（这就是单实例保证）',
        lastRun: this.lastRun,
      };
    }
    const started = Date.now();
    try {
      const hold = Math.min(2000, Math.max(0, Number(holdMs) || 0));
      if (hold > 0) await sleep(hold);
      const rows = 42;
      const durationMs = Date.now() - started;
      this.lastRun = {
        at: new Date().toISOString(),
        rows,
        durationMs,
        lock: 'reconcile',
      };
      return { ran: true, lock: 'acquired', lockTtlMs: ttlMs, rows, durationMs, lastRun: this.lastRun };
    } finally {
      // 无论成功失败都释放锁；真实项目还依赖 TTL 兜底。
      this.release('reconcile', owner);
    }
  }

  status() {
    return {
      cron: '0 2 * * *（每天 02:00 对账；真实项目由 @nestjs/schedule 的 @Cron 触发）',
      trigger: 'POST /schedule/reconcile 手动触发',
      locks: Array.from(this.locks.values()),
      lastRun: this.lastRun,
    };
  }
}
