/**
 * 手写弹性原语：超时、重试、熔断器。
 *
 * 真实项目一般直接用成熟库（cockatiel / opossum / p-retry），
 * 本文件把核心状态机写出来，方便对照理解：
 *   - 超时：Promise.race + setTimeout；真实请求还应 abort 掉底层连接；
 *   - 重试：只对幂等操作（GET/查询）重试，指数退避 + 上限，避免故障放大；
 *   - 熔断：closed → open（连续失败达阈值）→ half-open（冷却后放一个试探请求）
 *     → 成功回 closed / 失败回 open。
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as any).unref?.();
  });
}

/** 给 promise 加超时；注意底层任务不会被取消（真实项目用 AbortController）。 */
export async function withTimeout<T>(task: Promise<T>, timeoutMs: number, label = '外部调用'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(label + ' 超过 ' + timeoutMs + 'ms 未返回'));
    }, timeoutMs);
    (timer as any).unref?.();
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export interface RetryOptions {
  /** 总尝试次数（含第一次），默认 3。 */
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/** 指数退避重试：失败后等 baseDelay * 2^(n-1) 再试，最多 attempts 次。 */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, Math.round(options.attempts ?? 3));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 50);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 400);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      await sleep(Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  halfOpenMaxCalls?: number;
}

export class CircuitBreaker {
  private stateValue: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private halfOpenCalls = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly halfOpenMaxCalls: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 3);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 5000);
    this.halfOpenMaxCalls = Math.max(1, options.halfOpenMaxCalls ?? 1);
  }

  get state(): BreakerState {
    this.refresh();
    return this.stateValue;
  }

  /** open 超过冷却时间后自动进入 half-open，放少量请求试探。 */
  private refresh(): void {
    if (this.stateValue === 'open' && Date.now() - this.openedAt >= this.cooldownMs) {
      this.stateValue = 'half-open';
      this.halfOpenCalls = 0;
    }
  }

  canRequest(): boolean {
    this.refresh();
    if (this.stateValue === 'open') return false;
    if (this.stateValue === 'half-open') {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) return false;
      this.halfOpenCalls += 1;
    }
    return true;
  }

  onSuccess(): void {
    this.stateValue = 'closed';
    this.failures = 0;
    this.halfOpenCalls = 0;
  }

  onFailure(): void {
    this.failures += 1;
    if (this.stateValue === 'half-open' || this.failures >= this.failureThreshold) {
      this.stateValue = 'open';
      this.openedAt = Date.now();
      this.failures = this.failureThreshold;
    }
  }

  reset(): void {
    this.stateValue = 'closed';
    this.failures = 0;
    this.halfOpenCalls = 0;
    this.openedAt = 0;
  }

  snapshot() {
    this.refresh();
    return {
      state: this.stateValue,
      failures: this.failures,
      failureThreshold: this.failureThreshold,
      cooldownMs: this.cooldownMs,
      nextRetryInMs: this.stateValue === 'open' ? Math.max(0, this.cooldownMs - (Date.now() - this.openedAt)) : 0,
    };
  }
}
