import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, tap } from 'rxjs';
import { CacheService } from './cache.service';

/**
 * 练习 s4-4 · 手写 CacheInterceptor
 *
 * 真实项目直接 import { CacheInterceptor, CacheTTL, CacheKey } from '@nestjs/cache-manager'：
 *
 *   @UseInterceptors(CacheInterceptor)
 *   @CacheTTL(5)
 *   @Get(':id')
 *   findOne(...) {}
 *
 * 或全局注册：{ provide: APP_INTERCEPTOR, useClass: CacheInterceptor }。
 *
 * 官方 CacheInterceptor 默认只缓存 GET 请求，key 默认是请求 URL；
 * 这里的实现等价：GET 命中缓存直接返回，未命中执行 handler 并把结果写回缓存。
 */

/** 元数据 key：对应官方 @CacheTTL() 装饰器。 */
export const CACHE_TTL_METADATA = 'cache:ttl';

/** 给某个 GET 路由单独设置 TTL（秒）。 */
export const CacheTtl = (seconds: number) => SetMetadata(CACHE_TTL_METADATA, seconds);

interface CacheableRequest {
  method: string;
  url: string;
}

interface CacheableResponse {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<CacheableRequest>();

    // 与官方实现一致：只缓存 GET，写请求直接放行。
    if (request.method !== 'GET') return next.handle();

    const ttl =
      this.reflector.getAllAndOverride<number>(CACHE_TTL_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 5;

    // 真实项目可以用 @CacheKey() 自定义 key；这里默认用 URL（含 query，天然区分分页）。
    const key = 'http:' + request.url;
    const response = context.switchToHttp().getResponse<CacheableResponse>();
    const cached = this.cache.get<unknown>(key);

    if (cached !== undefined) {
      response.setHeader('X-Cache', 'HIT');
      response.setHeader('X-Cache-Ttl', String(ttl));
      return of(cached);
    }

    response.setHeader('X-Cache', 'MISS');
    response.setHeader('X-Cache-Ttl', String(ttl));
    return next.handle().pipe(
      tap((value) => {
        // 只缓存成功返回的结果；异常走异常过滤器，不会写缓存。
        this.cache.set(key, value, ttl);
      }),
    );
  }
}
