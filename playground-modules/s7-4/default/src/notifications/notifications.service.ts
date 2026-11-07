import { Injectable, OnModuleInit } from '@nestjs/common';
import { MessageBroker, TransportMessage } from '../transport/message-broker';

/**
 * 通知服务（消费者）。
 *
 * 等价真实项目里 @EventPattern('order.created') / @MessagePattern('notification.preview')
 * 的微服务消费者：
 *   - 用自己的收件箱（inbox）记录按 messageId 去重，保证消息重复投递时不重复发通知；
 *   - 消费失败抛错，消息进入死信队列（真实项目是 Kafka DLQ / BullMQ failed set），
 *     可以重放，不会丢；
 *   - 注意它完全不知道订单服务的类，二者只通过消息契约（pattern + payload）耦合。
 */

export interface NotificationRecord {
  messageId: string;
  orderId: number;
  channel: string;
  text: string;
  at: string;
}

@Injectable()
export class NotificationConsumerService implements OnModuleInit {
  private readonly inbox = new Map<string, NotificationRecord>();
  private readonly notifications: NotificationRecord[] = [];
  private failNext = 0;

  constructor(private readonly broker: MessageBroker) {}

  onModuleInit(): void {
    // 事件消费者：等价 @EventPattern('order.created')
    this.broker.register('order.created', (payload, message) => this.handleOrderCreated(payload, message));
    // 请求-响应消费者：等价 @MessagePattern('notification.preview')
    this.broker.register('notification.preview', (payload) => this.preview(payload));
  }

  private handleOrderCreated(payload: Record<string, unknown>, message: TransportMessage) {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('通知网关不可用（模拟）：消息进入死信队列，修复后可重放');
    }
    const orderId = Number(payload.orderId);
    const existing = this.inbox.get(message.id);
    if (existing !== undefined) {
      return { delivered: false, duplicate: true, orderId }; // 消费端幂等去重
    }
    const record: NotificationRecord = {
      messageId: message.id,
      orderId,
      channel: 'email',
      text: '订单 ' + orderId + ' 已创建（金额 ' + String(payload.amount) + ' 元），通知已发送',
      at: new Date().toISOString(),
    };
    this.inbox.set(message.id, record);
    this.notifications.push(record);
    return { delivered: true, duplicate: false, orderId };
  }

  private preview(payload: Record<string, unknown>) {
    const orderId = Number(payload.orderId);
    return {
      orderId,
      channel: 'sms',
      text: '【预览】订单 ' + orderId + ' 的通知内容（send 模式由通知服务即时计算返回）',
      computedAt: new Date().toISOString(),
    };
  }

  /** 故障注入：让接下来 count 次事件消费失败，用来观察死信队列。 */
  simulateFailure(count = 1): { failNext: number } {
    this.failNext = Math.min(5, Math.max(1, Math.round(count) || 1));
    return { failNext: this.failNext };
  }

  list(): NotificationRecord[] {
    return this.notifications.slice().reverse();
  }

  inboxSize(): number {
    return this.inbox.size;
  }
}
