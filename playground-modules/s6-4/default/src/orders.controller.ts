import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Body } from '@nestjs/common';
import { CreateOrderDto, Order, OrdersService } from './orders.service';

/**
 * 版本化演示。
 *
 * 真实项目用 @nestjs/common 的 VersioningType：
 *   app.enableVersioning({ type: VersioningType.URI });        // /v1/orders
 *   app.enableVersioning({ type: VersioningType.HEADER,
 *                          header: 'x-api-version' });         // Header 版本化
 *   控制器上写 @Controller({ path: 'orders', version: '1' })。
 *
 * 操练场没有启用版本化中间件，所以这里把版本直接写进路由 / 从请求头读取，
 * 效果等价，而且一眼能看出「旧版本继续可用」。
 */

@Controller('v1/orders')
export class OrdersV1Controller {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list() {
    return {
      version: 'v1',
      data: this.ordersService.list().map((order) => this.toV1(order)),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto) {
    const order = this.ordersService.create(dto);
    return { version: 'v1', data: this.toV1(order), docs: '请求体 schema 见 GET /docs/openapi.json' };
  }

  /** v1 的旧结构：只有 id/sku/qty/amount，没有 currency。 */
  private toV1(order: Order) {
    return { id: order.id, sku: order.sku, qty: order.qty, amount: order.amount };
  }
}

@Controller('v2/orders')
export class OrdersV2Controller {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list() {
    return { version: 'v2', data: this.ordersService.list() };
  }
}

@Controller('orders')
export class OrdersHeaderVersionController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Header 版本化：不带请求头走 v1，带 x-api-version: 2 走 v2（真实项目由 VersioningType.HEADER 自动完成）。 */
  @Get()
  list(@Headers('x-api-version') version?: string) {
    const v2 = String(version ?? '1') === '2';
    const orders = this.ordersService.list();
    return {
      version: v2 ? 'v2' : 'v1',
      source: 'header x-api-version',
      data: v2
        ? orders
        : orders.map((order) => ({ id: order.id, sku: order.sku, qty: order.qty, amount: order.amount })),
    };
  }
}
