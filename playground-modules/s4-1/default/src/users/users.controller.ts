import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateUserInput, OrdersService, UsersService } from './users.service';

/**
 * 练习 s4-1 · 控制器只做 HTTP 适配
 *
 * 路由：
 *   GET  /health          — 冒烟
 *   GET  /users           — 用户列表
 *   GET  /users/:id       — 用户详情（不存在 404）
 *   GET  /users/:id/orders— 关联查询：某用户的订单
 *   GET  /orders          — 订单列表
 *   POST /users           — 新建用户（{} 会得到 400，提示 email/name 必填）
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  async list() {
    return { data: await this.usersService.list(), total: await this.usersService.count() };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Get(':id/orders')
  async orders(@Param('id', ParseIntPipe) id: number) {
    return { userId: id, data: await this.ordersService.listByUser(id) };
  }

  @Post()
  create(@Body() body: CreateUserInput) {
    return this.usersService.create(body);
  }
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async list() {
    return { data: await this.ordersService.list(), total: await this.ordersService.count() };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findById(id);
  }
}
