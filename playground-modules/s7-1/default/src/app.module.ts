import { Module } from '@nestjs/common';
import { QueueModule } from './queue/queue.module';

/**
 * 练习 s7-1 · 队列、异步任务与调度
 *
 * 这一套默认代码把「耗时报表任务」移出请求链路，并用内存队列等价演示 BullMQ：
 *   - POST /queue/report 立刻返回 202 + jobId（生产者为请求线程，消费者异步执行）；
 *   - 每个任务有 attempts / maxAttempts / 指数 backoff，失败会进入 delayed 再重试，
 *     达到上限变成 failed（真实项目里留在 BullMQ 的 failed 集合，可重放）；
 *   - POST /queue/tick 手动触发消费，方便在请求台立刻观察 attempts 与退避；
 *   - POST /schedule/reconcile 用内存锁演示「多实例只让一个跑」的定时对账任务。
 *
 * 真实项目替换方式（未安装这些包，所以用内存实现）：
 *   - @nestjs/bull + BullMQ：@InjectQueue('report')、@Processor('report')、@Process()，
 *     new Queue('report', { defaultJobOptions: { attempts: 3,
 *       backoff: { type: 'exponential', delay: 1000 } } })；
 *   - @nestjs/schedule：@Cron('0 2 * * *') 跑对账，再用 Redis 分布式锁（Redlock）
 *     或 BullMQ 的 jobId 去重保证多实例只有一个执行者。
 */
@Module({
  imports: [QueueModule],
})
export class AppModule {}
