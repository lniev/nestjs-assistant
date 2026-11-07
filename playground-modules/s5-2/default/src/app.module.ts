import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { OrderPolicy } from './orders/order.policy';
import { AdminOrdersController, OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

/**
 * 练习 s5-2 · 授权：策略与 RBAC
 *
 * 结构：
 *   auth/actor.ts          身份解析 + 401 守卫 + @Roles() + 403 守卫
 *   orders/order.policy.ts 记录级策略（owner / staff / admin）+ 策略单测
 *   orders/orders.service.ts  内存订单仓储 + 业务规则
 *   orders/orders.controller.ts 订单路由与 admin 路由
 *
 * 建议动手：
 *   1. 用 ?as=1 访问 /orders/2，观察 403（而不是 404）；
 *   2. 去掉 ?as=，观察 401；对照两者响应里的 code 字段；
 *   3. 在 OrderPolicy 里加一条「paid 订单只有 admin 可改」，再到 /orders/policy-spec 看单测变红。
 *
 * 真实项目里会拆成 AuthModule / OrdersModule，并用 @nestjs/jwt + passport
 * 的 AuthGuard('jwt') 替代这里的 query 模拟登录。
 */
@Module({
  controllers: [AppController, OrdersController, AdminOrdersController],
  providers: [OrderPolicy, OrdersService],
})
export class AppModule {}
