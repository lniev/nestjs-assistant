import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, Post } from '@nestjs/common';
import { MessageBroker } from '../transport/message-broker';
import { OrderService, OutboxService } from './orders.service';

/**
 * 订单服务对外接口（等价一个独立的订单微服务的 HTTP 网关）。
 * 它只依赖自己的写模型 + outbox + 消息代理，不 import 通知服务的任何代码。
 */
@Controller()
export class OrdersController {
  constructor(
    private readonly orderService: OrderService,
    private readonly outbox: OutboxService,
    private readonly broker: MessageBroker,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's7-4', services: ['orders', 'notifications'] };
  }

  @Get('orders')
  listOrders() {
    return { orders: this.orderService.list() };
  }

  /** 下单：写订单 + 写 outbox，事务提交后用 emit 通知通知服务（不等结果）。 */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  createOrder(@Body() body: Record<string, unknown>) {
    return this.orderService.create({ sku: body?.sku, qty: body?.qty });
  }

  @Get('outbox')
  outboxList() {
    return {
      entries: this.outbox.list(),
      stats: this.broker.stats(),
      note: '真实项目 outbox 在数据库里，relay 重启后会继续投递 pending 记录',
    };
  }

  /** relay 的手动触发入口：把 pending 记录重新投递（演示用）。 */
  @Post('outbox/dispatch')
  @HttpCode(HttpStatus.OK)
  dispatch() {
    return this.outbox.dispatch();
  }

  /** 回滚演示：事务失败时订单与 outbox 都不落库，消息不会发出。 */
  @Post('orders/rollback-demo')
  @HttpCode(HttpStatus.OK)
  rollbackDemo() {
    return this.orderService.create({ rollback: true });
  }

  /** send 模式：请求-响应，订单服务同步等待通知服务返回预览内容。 */
  @Get('orders/:id/notification-preview')
  async preview(@Param('id') id: string) {
    const orderId = Number(id) > 0 ? Number(id) : 1;
    const preview = await this.broker.send('notification.preview', { orderId });
    return {
      mode: 'send（ClientProxy.send 等价：请求-响应，调用方等待消费端返回）',
      preview,
    };
  }
}

@Module({
  controllers: [OrdersController],
  providers: [OutboxService, OrderService],
})
export class OrdersModule {}
