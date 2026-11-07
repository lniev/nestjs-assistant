import { Injectable } from '@nestjs/common';

/**
 * 内存版 BullMQ 队列（生产者/消费者/重试/退避）。
 *
 * 真实项目：@nestjs/bull 的 @InjectQueue('report') + @Processor('report')。
 * 本文件手写等价物，重点是让你看清：
 *   - 入队只写一条记录，请求立刻返回（任务在后台消费）；
 *   - 每次消费失败 attempts + 1，未达 maxAttempts 就进入 delayed，
 *     按 exponential backoff（baseDelay * 2^(attempt-1)）重试；
 *   - 达到 maxAttempts 变成 failed（真实 BullMQ 的 failed set / 死信）。
 */

export type JobState = 'waiting' | 'active' | 'delayed' | 'completed' | 'failed';

export interface QueueJob {
  id: number;
  name: string;
  data: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  failAttempts: number;
  backoffMs: number;
  state: JobState;
  readyAt: number;
  logs: string[];
  result?: Record<string, unknown>;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueOptions {
  maxAttempts?: number;
  backoffMs?: number;
  failAttempts?: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    (timer as any).unref?.();
  });
}

@Injectable()
export class ReportQueueService {
  private readonly jobs: QueueJob[] = [];
  private nextId = 1;
  /** 串行化所有消费动作：自动 drain 与手动 tick 排队执行，避免同一个任务被并发处理两次。 */
  private runner: Promise<void> = Promise.resolve();

  /** 生产者：只负责入队，绝不在这里跑报表（接口耗时才不会被报表拖慢）。 */
  enqueue(data: Record<string, unknown>, options: EnqueueOptions = {}): QueueJob {
    const now = new Date().toISOString();
    const job: QueueJob = {
      id: this.nextId,
      name: 'report',
      data,
      attempts: 0,
      maxAttempts: clamp(options.maxAttempts ?? 3, 1, 5),
      failAttempts: clamp(options.failAttempts ?? 0, 0, 5),
      backoffMs: clamp(options.backoffMs ?? 50, 0, 5000),
      state: 'waiting',
      readyAt: 0,
      logs: [],
      createdAt: now,
      updatedAt: now,
    };
    this.nextId += 1;
    this.jobs.push(job);
    this.scheduleDrain(0);
    return job;
  }

  list(): QueueJob[] {
    return this.jobs.slice().reverse();
  }

  find(id: number): QueueJob | undefined {
    return this.jobs.find((job) => job.id === id);
  }

  stats() {
    const counts: Record<JobState, number> = {
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
    };
    for (const job of this.jobs) counts[job.state] += 1;
    return { total: this.jobs.length, counts };
  }

  /** 手动消费：每个未完成任务各尝试一次（忽略 backoff 等待），方便在请求台立刻看到 attempts 变化。 */
  async tick(): Promise<{ processed: number; jobs: QueueJob[] }> {
    const processed = await this.chainDrain(true);
    return { processed, jobs: this.list() };
  }

  private scheduleDrain(delayMs: number): void {
    const timer = setTimeout(() => {
      void this.chainDrain(false);
    }, Math.max(0, delayMs));
    (timer as any).unref?.();
  }

  /** 把一次消费动作接到串行队列尾部，返回本次处理的 job 数量。 */
  private chainDrain(force: boolean): Promise<number> {
    const run = this.runner.then(() => this.runDrain(force));
    this.runner = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async runDrain(force: boolean): Promise<number> {
    const attempted = new Set<number>();
    let processed = 0;
    while (true) {
      const now = Date.now();
      const next = this.jobs.find((job) => {
        if (attempted.has(job.id)) return false;
        if (job.state === 'waiting') return true;
        if (job.state === 'delayed') return force || job.readyAt <= now;
        return false;
      });
      if (next === undefined) break;
      attempted.add(next.id);
      await this.process(next);
      processed += 1;
    }
    return processed;
  }

  private async process(job: QueueJob): Promise<void> {
    job.state = 'active';
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    await sleep(5); // 模拟报表计算耗时

    const shouldFail = job.attempts <= job.failAttempts;
    if (!shouldFail) {
      job.state = 'completed';
      job.result = { rows: 100 + job.id, generatedAt: new Date().toISOString() };
      job.logs.push('第 ' + job.attempts + ' 次尝试成功，报表已生成');
      job.updatedAt = new Date().toISOString();
      return;
    }

    job.lastError = '报表数据源超时（模拟失败，failAttempts=' + job.failAttempts + '）';
    if (job.attempts < job.maxAttempts) {
      const delay = Math.min(2000, job.backoffMs * Math.pow(2, job.attempts - 1));
      job.state = 'delayed';
      job.readyAt = Date.now() + delay;
      job.logs.push('第 ' + job.attempts + ' 次失败：' + job.lastError + '，' + delay + 'ms 后重试');
      this.scheduleDrain(delay);
    } else {
      job.state = 'failed';
      job.logs.push('第 ' + job.attempts + ' 次失败，达到 maxAttempts，进入失败队列（等价 BullMQ failed set）');
    }
    job.updatedAt = new Date().toISOString();
  }
}
