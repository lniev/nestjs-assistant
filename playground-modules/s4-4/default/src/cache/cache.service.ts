import { Injectable } from '@nestjs/common';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  expirations: number;
  size: number;
  hitRatePercent: number;
  keys: string[];
}

/**
 * 练习 s4-4 · 内存缓存（TTL + 命中统计）
 *
 * 真实项目：@nestjs/cache-manager + cache-manager
 *
 *   CacheModule.register({ isGlobal: true, ttl: 60_000, max: 100 })
 *   constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}
 *   await this.cache.get(key) / set(key, value, ttl) / del(key)
 *
 * 生产环境通常换成 Redis（多实例共享），否则每个实例各有一份缓存。
 *
 * 一致性策略：**写路径主动失效**。更新/删除数据后清掉相关 key，
 * 而不是等 TTL 自然过期 —— 否则用户会看到旧数据。见 ProductsController。
 */
@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private expirations = 0;

  /** 读取；过期视为未命中并顺手删除（惰性过期，等价于 cache-manager 的 ttl 行为）。 */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.expirations += 1;
      this.misses += 1;
      return undefined;
    }
    entry.hits += 1;
    this.hits += 1;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 5;
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000, hits: 0 });
    this.sets += 1;
  }

  del(key: string): boolean {
    return this.store.delete(key);
  }

  /** 按前缀批量失效，常用于「列表 + 详情」一起清。 */
  delByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): number {
    const size = this.store.size;
    this.store.clear();
    return size;
  }

  stats(): CacheStats {
    const now = Date.now();
    const keys = [...this.store.entries()]
      .filter(([, entry]) => entry.expiresAt > now)
      .map(([key, entry]) => key + '（剩余 ' + Math.max(0, Math.ceil((entry.expiresAt - now) / 1000)) + 's）');
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      expirations: this.expirations,
      size: this.store.size,
      hitRatePercent: total === 0 ? 0 : Math.round((this.hits / total) * 100),
      keys,
    };
  }
}
