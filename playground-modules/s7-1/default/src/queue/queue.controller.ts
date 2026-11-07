import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { ReportQueueService } from './queue.service';
import { SchedulerService } from './scheduler.service';

/**
 * 队列 HTTP 入口。
 *
 * 注意 POST /queue/report 返回 202 Accepted：请求只负责入队，
 * 真正耗时的报表由消费者异步执行 —— 这样接口 P95 不会因为报表变慢。
 */
@Controller()
export class QueueController {
  constructor(private readonly queue: ReportQueueService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's7-1', queue: this.queue.stats() };
  }

  /** 入队；body 可传 failAttempts / maxAttempts / backoffMs 观察重试。 */
  @Post('queue/report')
  @HttpCode(HttpStatus.ACCEPTED)
  enqueueReport(@Body() body: Record<string, unknown>) {
    const job = this.queue.enqueue(
      { reportDate: String(body?.reportDate ?? new Date().toISOString().slice(0, 10)) },
      {
        maxAttempts: Number(body?.maxAttempts),
        backoffMs: Number(body?.backoffMs),
        failAttempts: Number(body?.failAttempts),
      },
    );
    return {
      accepted: true,
      jobId: job.id,
      state: job.state,
      hint: '用 GET /queue/jobs/' + job.id + ' 观察 attempts；POST /queue/tick 可立刻手动消费',
    };
  }

  @Get('queue/jobs')
  listJobs() {
    return { jobs: this.queue.list() };
  }

  @Get('queue/jobs/:id')
  getJob(@Param('id') id: string) {
    const job = this.queue.find(Number(id));
    if (job === undefined) throw new NotFoundException('任务不存在：' + id);
    return { job };
  }

  @Get('queue/stats')
  stats() {
    return this.queue.stats();
  }

  /** 手动消费（等价 BullMQ Worker 的一次 tick），便于立刻观察重试与退避。 */
  @Post('queue/tick')
  @HttpCode(HttpStatus.OK)
  async tick() {
    const result = await this.queue.tick();
    return { processed: result.processed, stats: this.queue.stats(), jobs: result.jobs };
  }
}

/** 调度入口：手动触发一次对账，观察内存锁是否被占用。 */
@Controller('schedule')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Get('status')
  status() {
    return this.scheduler.status();
  }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  reconcile(@Body() body: Record<string, unknown>) {
    return this.scheduler.reconcile(Number(body?.holdMs));
  }
}
