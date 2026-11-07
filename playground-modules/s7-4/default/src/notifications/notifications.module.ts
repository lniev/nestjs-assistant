import { Body, Controller, Get, HttpCode, HttpStatus, Module, Post } from '@nestjs/common';
import { MessageBroker } from '../transport/message-broker';
import { NotificationConsumerService } from './notifications.service';

/**
 * 通知服务对外接口（等价独立通知微服务的查询/运维接口）。
 * 这些接口只读通知服务自己的收件箱和死信队列，不访问订单库。
 */
@Controller()
export class NotificationsController {
  constructor(
    private readonly consumer: NotificationConsumerService,
    private readonly broker: MessageBroker,
  ) {}

  /** emit 是发后不管的；为了让操练场里「下单后立刻查询」能看到结果，这里等消费任务结束。 */
  @Get('notifications')
  async listNotifications() {
    await this.broker.settled();
    return {
      mode: 'emit 消费结果（fire-and-forget）',
      delivered: this.consumer.list(),
      inboxSize: this.consumer.inboxSize(),
      hint: 'POST /orders 之后再看这里；重复消息会按 messageId 去重',
    };
  }

  @Get('dead-letters')
  async deadLetters() {
    await this.broker.settled();
    return {
      deadLetters: this.broker.deadLetterSnapshot(),
      stats: this.broker.stats(),
      hint: '先 POST /notifications/fail，再 POST /orders，就能看到一条死信',
    };
  }

  /** 故障注入：让下一次事件消费失败（消息进死信，可重放）。 */
  @Post('notifications/fail')
  @HttpCode(HttpStatus.OK)
  failNext(@Body() body: Record<string, unknown>) {
    return { ok: true, ...this.consumer.simulateFailure(Number(body?.count)) };
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationConsumerService],
})
export class NotificationsModule {}
