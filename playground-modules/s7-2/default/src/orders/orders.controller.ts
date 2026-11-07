import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '../cqrs/cqrs';
import { EventBus } from '../events/event-bus.service';
import { NotificationListener, PointsListener } from './orders.listeners';
import { OrderView } from './orders.services';

/**
 * 控制器只依赖总线，不 import 写服务 / 读服务的具体实现 ——
 * 这是 CQRS 在 HTTP 层的体现：命令走 CommandBus，查询走 QueryBus。
 */
@Controller()
export class OrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly events: EventBus,
    private readonly notifications: NotificationListener,
    private readonly points: PointsListener,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's7-2' };
  }

  /** 查询路径：只读读模型，不触发任何写入。 */
  @Get('orders')
  listOrders(): Promise<OrderView[]> {
    return this.queryBus.execute<OrderView[]>({ kind: 'list-orders' });
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string): Promise<OrderView> {
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) throw new BadRequestException('id 必须是正整数');
    return this.queryBus.execute<OrderView>({ kind: 'get-order', id: orderId });
  }

  /** 命令路径：返回写模型结果；通知等副作用由事件监听器异步/隔离执行。 */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() body: Record<string, unknown>) {
    const startedAt = Date.now();
    const order = await this.commandBus.execute({
      kind: 'create-order',
      sku: body?.sku,
      qty: body?.qty,
      failNotification: body?.failNotification === true,
    });
    return {
      order,
      durationMs: Date.now() - startedAt,
      note: '通知/积分等副作用走事件，处理器失败不影响本次下单；见 GET /events',
    };
  }

  /** 事件日志：能直接看到每个监听器是否抛错（失败隔离的证据）。 */
  @Get('events')
  eventLog() {
    return {
      semantics: 'emit 同步执行监听器；单个监听器抛错会被捕获并记录，不会把错误抛给下单接口',
      listeners: { 'order.created': this.events.listeners('order.created') },
      log: this.events.log(),
    };
  }

  @Get('notifications')
  notificationList() {
    return { notifications: this.notifications.list() };
  }

  @Get('points')
  pointsSnapshot() {
    return this.points.snapshot();
  }

  /** CQRS 注册表：能直观看到命令与查询是两条独立通道。 */
  @Get('commands')
  busInfo() {
    return { commands: this.commandBus.registered(), queries: this.queryBus.registered() };
  }
}
