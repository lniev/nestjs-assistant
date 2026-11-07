import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Actor, AuthenticatedGuard, Roles, RolesGuard } from '../auth/actor';
import { Order, runPolicySpec } from './order.policy';
import { OrdersService } from './orders.service';

/**
 * 订单资源。三个演示入口（用请求台试）：
 *
 *   1) 未登录：        GET /orders/2                -> 401 AUTH_REQUIRED
 *   2) 越权访问他人单：GET /orders/2?as=1           -> 403 ORDER_FORBIDDEN
 *   3) 内部角色：      GET /orders/2?as=9           -> 200（staff 可读任意订单）
 *
 * ?as=1 是操练场的「模拟登录」；真实项目换成 Authorization: Bearer <jwt>，
 * 由 AuthGuard('jwt') 解析出 request.user。
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * 策略单测入口（放在 ':id' 之前，避免被当成订单 id）。
   * 真实项目：npm test 跑 jest 里的 order.policy.spec.ts。
   */
  @Get('policy-spec')
  policySpec() {
    const results = runPolicySpec();
    const failed = results.filter((item) => !item.ok).length;
    return { ok: failed === 0, total: results.length, passed: results.length - failed, failed, results };
  }

  /** 列表按策略过滤：?as=1（alice）只返回自己的两单，?as=9（staff）返回全部。 */
  @Get()
  @UseGuards(AuthenticatedGuard, RolesGuard)
  list(@Actor() actor: Actor) {
    return { as: actor.name, role: actor.role, orders: this.ordersService.listFor(actor) };
  }

  /** 单条读取：不存在 404；他人订单 403。 */
  @Get(':id')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  findOne(@Actor() actor: Actor, @Param('id', ParseIntPipe) id: number): Order {
    return this.ordersService.findFor(actor, id);
  }

  /** 客户只能改自己 open 状态的订单；staff/admin 可以改任意订单状态。 */
  @Patch(':id')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  update(
    @Actor() actor: Actor,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: Order['status'] },
  ): Order {
    return this.ordersService.updateStatus(actor, id, body?.status);
  }

  /** 只有 admin 能删。客户（?as=1）删除自己的订单也会被策略拒绝 → 403。 */
  @Delete(':id')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  remove(@Actor() actor: Actor, @Param('id', ParseIntPipe) id: number) {
    return this.ordersService.remove(actor, id);
  }
}

/**
 * 内部管理接口：用 RolesGuard 做「路由级」角色校验。
 *   客户 GET /admin/orders?as=1   -> 403 ROLE_FORBIDDEN
 *   staff GET /admin/orders?as=9  -> 200
 */
@Controller('admin')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('staff', 'admin')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('orders')
  list() {
    return { scope: 'admin', orders: this.ordersService.findAll() };
  }
}
