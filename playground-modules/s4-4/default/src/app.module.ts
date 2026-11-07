import { Controller, Delete, Get, Module } from '@nestjs/common';
import { CacheService } from './cache/cache.service';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';

/**
 * 练习 s4-4 · 缓存与读性能
 *
 * 接线：
 *   CacheService       手写 TTL 缓存（等价 cache-manager）→ 由缓存拦截器使用
 *   CacheInterceptor   只缓存 GET，key 默认取 URL，TTL 由 @CacheTtl() 覆盖
 *
 * 真实项目接线方式（对照）：
 *
 *   imports: [CacheModule.register({ isGlobal: true, ttl: 60_000 })],
 *   providers: [{ provide: APP_INTERCEPTOR, useClass: CacheInterceptor }],
 *
 * 这里用 @UseInterceptors(CacheInterceptor) 精确挂在热点接口上，方便你对比缓存前后差异。
 */
@Controller()
export class AppController {
  constructor(private readonly cache: CacheService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's4-4' };
  }

  /** 命中/未命中、命中率、当前 key 与剩余 TTL —— 观察缓存行为的主入口。 */
  @Get('cache/stats')
  stats() {
    return this.cache.stats();
  }

  /** 清空所有缓存（对比实验时先清一遍）。 */
  @Delete('cache')
  clear() {
    return { ok: true, removed: this.cache.clear() };
  }
}

@Module({
  controllers: [AppController, ProductsController],
  providers: [CacheService, ProductsService],
})
export class AppModule {}
