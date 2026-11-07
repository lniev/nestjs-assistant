import {
  forwardRef,
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BService } from '../b/b.service';

/**
 * 练习 s3-4 · 循环依赖（forwardRef）与生命周期钩子
 *
 * AService 与 BService 构成「A → B → A」的循环引用：
 *   - AModule / BModule 在模块层用 forwardRef(() => ...) 打破 import 循环；
 *   - AService 在构造层用 @Inject(forwardRef(() => BService)) 注入 B；
 *   - BService 不构造注入 A，而是用 ModuleRef 在调用时延迟解析，
 *     这样即使不拆模块也能避免「构造期互相等待」。
 *
 * 真实项目里 forwardRef 只是止血：更好的做法是拆出第三个模块（共享的缓存/事件），
 * 或者用 @nestjs/event-emitter 发布事件解耦。
 *
 * 生命周期：OnModuleInit 做启动预热，OnApplicationShutdown 做优雅关闭。
 * 需要 bootstrap.ts 里 app.enableShutdownHooks() 才能在收到 SIGTERM 时触发关闭钩子。
 */

/** 生命周期日志（内存数组，仅用于通过 /lifecycle 路由观察，真实项目应写日志/监控）。 */
export const A_LIFECYCLE_LOG: string[] = [];

@Injectable()
export class AService implements OnModuleInit, OnApplicationShutdown {
  private warmedUp = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    // forwardRef 必须两边都写吗？模块层必须；构造层只有「被循环注入的一侧」需要，
    // 这里 B 改成 ModuleRef 后其实可省，但保留它方便你对照两种写法。
    @Inject(forwardRef(() => BService))
    private readonly bService: BService,
  ) {}

  onModuleInit(): void {
    // 真实项目在这里预热：连接池 ping、字典加载、缓存预热、注册消费者……
    this.warmedUp = true;
    A_LIFECYCLE_LOG.push('AService.onModuleInit：预热完成');
    console.log('[s3-4] AService 预热完成（模拟连接池/字典预热）');
  }

  onApplicationShutdown(signal?: string): void {
    this.warmedUp = false;
    A_LIFECYCLE_LOG.push('AService.onApplicationShutdown：' + (signal || 'normal'));
    console.log('[s3-4] AService 优雅关闭，释放模拟连接');
  }

  /** 构造注入的 B：直接调用。 */
  ping() {
    return {
      from: 'A',
      via: 'forwardRef 构造注入',
      reply: this.bService.pong(),
      warm: this.warmedUp,
    };
  }

  /** ModuleRef 版：调用时才从容器里取 B，适合可选依赖/延迟初始化。 */
  pingViaModuleRef() {
    const b = this.moduleRef.get<BService>(BService, { strict: false });
    return { from: 'A', via: 'ModuleRef.get（延迟解析）', reply: b.pong() };
  }

  /** 供 B 反向调用，验证环是双向可用的。 */
  pong(): string {
    return 'pong from A';
  }
}
