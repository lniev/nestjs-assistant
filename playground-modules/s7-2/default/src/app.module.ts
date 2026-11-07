import { Module } from '@nestjs/common';
import { CommandBus, QueryBus } from './cqrs/cqrs';
import { EventBus } from './events/event-bus.service';
import { OrdersController } from './orders/orders.controller';
import { NotificationListener, PointsListener } from './orders/orders.listeners';
import { OrderReadModel, OrderWriteService } from './orders/orders.services';

/**
 * 练习 s7-2 · 事件驱动与 CQRS
 *
 * 这一套默认代码把「下单」拆成三条互不耦合的路径：
 *   1. 写路径：POST /orders → CommandBus.execute({ kind: 'create-order' })；
 *   2. 读路径：GET /orders、GET /orders/:id → QueryBus.execute(...)，
 *      读模型只由 order.created 事件更新，写路径不直接碰它（CQRS 分离）；
 *   3. 副作用：NotificationListener / PointsListener 订阅 order.created，
 *      用事件总线解耦。通知处理器故意可失败，但下单照样成功。
 *
 * 真实项目替换方式（未安装这些包，所以手写等价物）：
 *   - @nestjs/event-emitter：@OnEvent('order.created', { async: true })，
 *     EventEmitter2 的 emit 默认同步、emitAsync 等待所有监听器；
 *   - @nestjs/cqrs：CommandBus / QueryBus + @CommandHandler / @QueryHandler，
 *     本工程的 src/cqrs/cqrs.ts 是它最简版（工厂注册代替装饰器扫描）。
 *
 * 建议动手：
 *   - POST /orders { "failNotification": true }：观察下单仍返回 201，
 *     GET /events 里 NotificationListener 的错误被记录下来（失败被隔离）；
 *   - 把命令处理器改成「先写订单再发事件」与「先发事件再写订单」，
 *     对比 GET /events 与 GET /orders 的时序差异（最终一致性边界）。
 */
@Module({
  controllers: [OrdersController],
  providers: [
    EventBus,
    CommandBus,
    QueryBus,
    OrderWriteService,
    OrderReadModel,
    NotificationListener,
    PointsListener,
  ],
})
export class OrdersModule {}

@Module({
  imports: [OrdersModule],
})
export class AppModule {}
