import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../events/event-bus.service';
import { Order } from './orders.services';

/**
 * 事件监听器（等价 @OnEvent('order.created') 的一组处理器）。
 *
 * 每个监听器只做一件事：创建通知、扣积分。它们由事件总线触发，
 * 发布方（下单）不 import 它们的任何代码 —— 以后加「发优惠券」「同步 CRM」
 * 只新增监听器，不用改下单逻辑。
 */

export interface NotificationRecord {
  orderId: number;
  channel: string;
  text: string;
  at: string;
}

@Injectable()
export class NotificationListener implements OnModuleInit {
  private readonly notifications: NotificationRecord[] = [];

  constructor(private readonly events: EventBus) {}

  onModuleInit(): void {
    this.events.on('order.created', 'NotificationListener', (event) => {
      this.send(event.payload.order as Order);
    });
  }

  private send(order: Order): void {
    if (order.failNotification === true) {
      // 故意抛错：EventBus 会捕获并记录，订单已经提交，所以不会回滚。
      throw new Error('邮件网关超时（模拟）：通知失败，但下单已成功，失败只进事件日志');
    }
    this.notifications.push({
      orderId: order.id,
      channel: 'email',
      text: '订单 ' + order.id + '（' + order.sku + ' × ' + order.qty + '）已创建，金额 ' + order.amount + ' 元',
      at: new Date().toISOString(),
    });
  }

  list(): NotificationRecord[] {
    return this.notifications;
  }
}

export interface PointsLedgerEntry {
  orderId: number;
  change: number;
  balance: number;
  at: string;
}

@Injectable()
export class PointsListener implements OnModuleInit {
  private balance = 1000;
  private readonly ledger: PointsLedgerEntry[] = [];

  constructor(private readonly events: EventBus) {}

  onModuleInit(): void {
    this.events.on('order.created', 'PointsListener', (event) => {
      const order = event.payload.order as Order;
      const change = -Math.round(order.amount);
      this.balance += change;
      this.ledger.push({ orderId: order.id, change, balance: this.balance, at: new Date().toISOString() });
    });
  }

  snapshot() {
    return { balance: this.balance, ledger: this.ledger };
  }
}
