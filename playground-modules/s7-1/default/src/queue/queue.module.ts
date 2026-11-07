import { Module } from '@nestjs/common';
import { QueueController, SchedulerController } from './queue.controller';
import { ReportQueueService } from './queue.service';
import { SchedulerService } from './scheduler.service';

/** 队列模块：把生产者（控制器）、消费者（ReportQueueService）和调度器收在一起。 */
@Module({
  controllers: [QueueController, SchedulerController],
  providers: [ReportQueueService, SchedulerService],
  exports: [ReportQueueService, SchedulerService],
})
export class QueueModule {}
