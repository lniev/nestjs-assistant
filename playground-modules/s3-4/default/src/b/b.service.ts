import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AService } from '../a/a.service';

/**
 * 练习 s3-4 · 循环依赖的另一端
 *
 * BService 反向依赖 AService，但刻意**不用构造注入**，而是注入 ModuleRef，
 * 在真正需要时再 get(AService)。这是官方推荐的「延迟解析」解法：
 *   - 构造顺序不再是 A 等 B、B 等 A，Nest 初始化时不会卡在环里；
 *   - 代价是依赖关系不在构造函数签名里显式体现，读代码时要更留意。
 *
 * 如果坚持 A、B 都构造注入，则两侧都要 @Inject(forwardRef(() => X))，
 * 并且模块层也要 forwardRef，否则会报 "Nest can't resolve dependencies"。
 */

/** 生命周期日志（内存数组，仅用于通过 /lifecycle 路由观察）。 */
export const B_LIFECYCLE_LOG: string[] = [];

@Injectable()
export class BService implements OnModuleInit, OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    B_LIFECYCLE_LOG.push('BService.onModuleInit：预热完成');
    console.log('[s3-4] BService 预热完成（模拟消费者注册）');
  }

  onApplicationShutdown(signal?: string): void {
    B_LIFECYCLE_LOG.push('BService.onApplicationShutdown：' + (signal || 'normal'));
    console.log('[s3-4] BService 优雅关闭，注销模拟消费者');
  }

  /** 通过 ModuleRef 延迟拿到 AService 再反向调用。 */
  ping() {
    const a = this.moduleRef.get<AService>(AService, { strict: false });
    return { from: 'B', via: 'ModuleRef.get（延迟解析）', reply: a.pong() };
  }

  /** 供 A 正向调用。 */
  pong(): string {
    return 'pong from B';
  }
}
