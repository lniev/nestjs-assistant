import { Controller, Get, Module, Post } from '@nestjs/common';
import { InMemoryDatabase } from './database/database';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

/**
 * 练习 s4-2 · 事务、关联与查询性能
 *
 * 事务边界、分页关联、N+1 对比都集中在 OrdersService；这里只做接线。
 *
 * 真实项目接线方式：
 *   TypeOrmModule.forRoot({ logging: ['query'] }),   // 打开 SQL 日志
 *   TypeOrmModule.forFeature([Order, Product, User]),
 *
 * 操练场用内存库模拟同样的能力（见 database/database.ts）。
 */
@Controller()
export class AppController {
  constructor(private readonly db: InMemoryDatabase) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's4-2' };
  }

  /** 商品与库存列表，方便观察下单/并发演练后的库存变化。 */
  @Get('products')
  products() {
    return this.db.productsAll();
  }

  /** 查询统计 + 最近 8 条「SQL 日志」，用来验证 N+1 与固定条数。 */
  @Get('db/stats')
  stats() {
    return this.db.stats();
  }

  /** 清空查询计数与日志（对比实验前先归零）。 */
  @Post('db/reset-stats')
  resetStats() {
    this.db.resetStats();
    return { ok: true, message: '查询计数与 SQL 日志已清空' };
  }
}

@Module({
  controllers: [AppController, OrdersController],
  providers: [InMemoryDatabase, OrdersService],
})
export class AppModule {}
