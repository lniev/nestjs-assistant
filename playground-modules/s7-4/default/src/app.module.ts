import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { TransportModule } from './transport/message-broker';

/**
 * 练习 s7-4 · 微服务拆分与消息一致性
 *
 * 真实项目里「订单服务」和「通知服务」是两个独立进程，通过 TCP/Kafka/NATS
 * 通信（@nestjs/microservices 的 ClientProxy + @MessagePattern / @EventPattern）。
 * 操练场只有一个进程，所以这里用两个 Nest 模块 + 一个内存消息代理近似：
 *
 *   - OrdersModule（订单服务）：写订单 + 写 outbox 在同一个「事务」里提交，
 *     事务成功后才由 outbox 投递 order.created 事件；
 *   - NotificationsModule（通知服务）：消费 order.created，写入自己的收件箱，
 *     并按 messageId 幂等去重；消费失败会进死信队列。
 *
 * 两种通信模式都演示了（等价 ClientProxy）：
 *   - send：请求-响应，GET /orders/:id/notification-preview 等待通知服务返回值；
 *   - emit：发后不管，POST /orders 不等待通知结果。
 *
 * 真实项目替换方式（未安装这些包）：
 *   - @nestjs/microservices：ClientsModule.register([{ name: 'NOTIFY',
 *       transport: Transport.KAFKA, options: {...} }])，
 *     用 client.send('pattern', payload) / client.emit('event', payload)；
 *   - outbox：订单表 + outbox 表同事务写入，再由 relay 轮询或 CDC 投递，
 *     消费端用 messageId 唯一索引做幂等，失败进死信队列告警。
 *
 * 建议动手：
 *   - POST /notifications/fail 让下一次消费失败 → 再 POST /orders →
 *     GET /dead-letters 能看到死信（消息没丢，可重放）；
 *   - POST /orders/rollback-demo 观察「事务回滚时消息不会发出」。
 */
@Module({
  imports: [TransportModule, OrdersModule, NotificationsModule],
})
export class AppModule {}
