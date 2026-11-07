import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTtl } from '../cache/cache.interceptor';
import { CacheService } from '../cache/cache.service';
import { ProductsService } from './products.service';

/**
 * 练习 s4-4 · 给热点读接口加缓存，并在写路径主动失效
 *
 *   GET  /products       列表（缓存 2s）
 *   GET  /products/:id   详情（缓存 5s，响应头 X-Cache: HIT/MISS）
 *   PATCH /products/:id  更新 → 清掉 http:/products 前缀缓存（下一次 GET 必 MISS）
 *   POST /products       新增 → 同样清缓存
 *
 * 动手实验：
 *   1. 连续两次 GET /products/1，对比响应耗时、fetchedAt 与 X-Cache 头；
 *   2. PATCH /products/1 改价格后再 GET，确认拿到新值（旧缓存已被清除）；
 *   3. 等 TTL 过期再 GET，观察 X-Cache 变回 MISS —— 这就是 TTL 与一致性代价。
 */
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTtl(2)
  list() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @CacheTtl(5)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; price?: number; stock?: number },
  ) {
    const updated = await this.productsService.update(id, body);
    // 主动失效：真实项目里缓存 key 可能散在多个维度（详情/列表/聚合），要一起清。
    const invalidatedKeys = this.cache.delByPrefix('http:/products');
    return { ...updated, cache: { invalidatedKeys, nextGetWillMiss: true } };
  }

  @Post()
  async create(@Body() body: { name?: string; price?: number; stock?: number }) {
    const created = await this.productsService.create(body);
    const invalidatedKeys = this.cache.delByPrefix('http:/products');
    return { ...created, cache: { invalidatedKeys } };
  }
}
