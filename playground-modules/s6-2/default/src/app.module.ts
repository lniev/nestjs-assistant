import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthController, AuthService } from './auth/auth';
import { AppExceptionFilter } from './common/error-contract';
import { BearerAuthGuard, OrdersController, OrdersService } from './orders/orders';

/**
 * 练习 s6-2 · e2e 测试与回归套件
 *
 * 结构：
 *   common/error-contract.ts   统一错误契约 + 全局异常过滤器（APP_FILTER）
 *   auth/auth.ts               AuthService（登录/校验 token）+ 登录路由
 *   orders/orders.ts           OrdersService + BearerAuthGuard + 受保护订单路由
 *   e2e/regression.ts          6 条回归场景（401 两种 / 403 / 400 / 主链路）
 *   app.controller.ts          /health 与 /e2e/run
 *
 * 建议动手：
 *   1. GET /e2e/run 看 6 条全绿；
 *   2. 请求台 POST /auth/login（body {}），确认 401 响应里有 code 与 traceId；
 *   3. 把 OrdersService.create 的 item 校验删掉，再跑 /e2e/run —— 第五条应该变红。
 *
 * 真实项目：npm run test:e2e = jest --config test/jest-e2e.json，
 * 用 createNestApplication + supertest 起真实 HTTP 管道，CI 里跑完即清理数据库。
 */
@Module({
  controllers: [AppController, AuthController, OrdersController],
  providers: [
    AuthService,
    OrdersService,
    BearerAuthGuard,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule {}
