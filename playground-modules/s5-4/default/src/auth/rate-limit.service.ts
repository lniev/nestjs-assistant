import { Injectable } from '@nestjs/common';
import { SECURITY_CONFIG } from '../security/security';

export interface LimitState {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  resetAt: number;
}

/**
 * 登录限流器（内存滑动窗口）。
 *
 * 真实项目用 @nestjs/throttler：
 *   ThrottlerModule.forRoot([{ name: 'login', ttl: 60000, limit: 5 }])
 *   @Throttle({ login: { limit: 5, ttl: 60000 } })  // 只给登录路由更严格
 *   @UseGuards(ThrottlerGuard)
 * 它的存储可以换成 Redis，多实例部署时才有意义；这里用 Map 演示算法。
 *
 * 维度：IP + 用户名。只按 IP 容易被同一出口误伤，只按用户名可被撞库绕过。
 */
@Injectable()
export class LoginRateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** 只读检查：返回是否放行、剩余次数、需要等待多少秒。 */
  check(key: string): LimitState {
    const now = Date.now();
    const bucket = this.prune(key, now);
    const max = SECURITY_CONFIG.login.maxAttempts;
    const remaining = Math.max(0, max - bucket.length);
    const oldest = bucket.length > 0 ? bucket[0] : now;
    return {
      allowed: bucket.length < max,
      remaining,
      retryAfterSec: bucket.length < max ? 0 : Math.ceil((oldest + SECURITY_CONFIG.login.windowMs - now) / 1000),
      resetAt: oldest + SECURITY_CONFIG.login.windowMs,
    };
  }

  /** 记录一次尝试（无论成功失败都算，防止成功前爆破）。 */
  record(key: string): void {
    const now = Date.now();
    const bucket = this.prune(key, now);
    bucket.push(now);
    this.hits.set(key, bucket);
  }

  /** 忘记密码成功登录后清空计数。 */
  reset(key: string): void {
    this.hits.delete(key);
  }

  /** 给 /auth/rate-limit 用：展示当前窗口内的尝试次数。 */
  snapshot(key: string) {
    const now = Date.now();
    const bucket = this.prune(key, now);
    return {
      key,
      attempts: bucket.length,
      maxAttempts: SECURITY_CONFIG.login.maxAttempts,
      windowMs: SECURITY_CONFIG.login.windowMs,
      remaining: Math.max(0, SECURITY_CONFIG.login.maxAttempts - bucket.length),
      note: '同一 IP + 用户名第 6 次请求会返回 429 RATE_LIMITED',
    };
  }

  /** 滑动窗口：只保留 windowMs 之内的记录。 */
  private prune(key: string, now: number): number[] {
    const windowMs = SECURITY_CONFIG.login.windowMs;
    const bucket = (this.hits.get(key) ?? []).filter((ts) => now - ts < windowMs);
    this.hits.set(key, bucket);
    return bucket;
  }
}
