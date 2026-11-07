import { Module } from '@nestjs/common';
import { DocsController, ReleaseController } from './docs.controller';
import { HealthController } from './health.controller';
import {
  OrdersHeaderVersionController,
  OrdersV1Controller,
  OrdersV2Controller,
} from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * 练习 s6-4 · 文档、版本化与上线
 *
 * 这一套默认代码演示三件事：
 *   1. 「文档」：手写 @ApiProperty + OpenAPI 文档生成（等价 @nestjs/swagger），
 *      由 GET /docs/openapi.json 暴露，GET /docs 是一个极简 Swagger UI 页面；
 *   2. 「版本化」：/v1/orders 与 /v2/orders 是 URI 版本化，
 *      /orders 读 x-api-version 请求头是 Header 版本化；
 *   3. 「上线」：/health 是 liveness、/health/ready 是 readiness，
 *      GET /deploy/checklist 给出容器化上线清单（Dockerfile 片段 + 探针）。
 *
 * 建议动手：
 *   - 给 CreateOrderDto 再加一个 @ApiProperty 字段，重新访问 /docs/openapi.json，
 *     观察 schema 自动多出一个属性（这就是「DTO 装饰器保持同步」）。
 *   - 用 POST /health/dependency { "up": false } 让假依赖不可用，
 *     再访问 /health/ready 观察 503。
 *   - 新增 /v3/orders 控制器，体会「旧版本继续可用」的兼容策略。
 */
@Module({
  controllers: [
    DocsController,
    ReleaseController,
    HealthController,
    OrdersV1Controller,
    OrdersV2Controller,
    OrdersHeaderVersionController,
  ],
  providers: [OrdersService],
})
export class AppModule {}
