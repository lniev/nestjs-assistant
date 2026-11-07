import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateOrderInput, OrdersService } from './orders.service';

/**
 * 练习 s4-2 · 路由一览
 *
 *   GET  /health              冒烟
 *   GET  /products            商品列表（看库存）
 *   GET  /orders?page=1&size=10   ✅ 分页列表（响应里带 sqlCount）
 *   GET  /orders/n-plus-one      ❌ 同样的列表，但用 N+1 写法，对比 sqlCount
 *   GET  /orders/:id          订单详情（3 条 SQL）
 *   POST /orders              下单事务（body 可省略：默认 productId=1&quantity=1）
 *   POST /orders/stress       并发下单演示（5 单同时买 2 件，验证不超卖）
 *   GET  /db/stats            最近的 SQL 日志与各表行数
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Query('page') page?: string, @Query('size') size?: string) {
    return this.ordersService.list(page, size);
  }

  @Get('n-plus-one')
  listNPlusOne(@Query('page') page?: string, @Query('size') size?: string) {
    return this.ordersService.listNPlusOne(page, size);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findById(id);
  }

  @Post('stress')
  stress() {
    return this.ordersService.stressTest();
  }

  @Post()
  create(@Body() body: CreateOrderInput) {
    return this.ordersService.createOrder(body);
  }
}
