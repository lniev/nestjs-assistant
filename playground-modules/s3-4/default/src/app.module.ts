import { Controller, Get, Module } from '@nestjs/common';
import { AModule } from './a/a.module';
import { A_LIFECYCLE_LOG, AService } from './a/a.service';
import { BModule } from './b/b.module';
import { B_LIFECYCLE_LOG, BService } from './b/b.service';

/**
 * 练习 s3-4 · 循环依赖与生命周期
 *
 * 可改的地方：
 *   1. 把 AService 构造注入的 forwardRef 删掉，观察启动报错（构造期循环）；
 *   2. 给 AService/BService 增加 OnModuleDestroy / beforeApplicationShutdown，
 *      对比各个生命周期钩子的执行顺序（日志数组在 GET /lifecycle 里看）；
 *   3. 把 BService 的 ModuleRef 换成构造注入 + 两侧 forwardRef，感受两种解法的差异。
 *
 * 路由：GET /health、GET /lifecycle、GET /a/ping、GET /b/ping、GET /a/lazy
 */
@Controller()
export class AppController {
  constructor(
    private readonly aService: AService,
    private readonly bService: BService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's3-4' };
  }

  /** 查看启动预热与关闭日志（关闭日志要等应用停止后才写入，属于预期）。 */
  @Get('lifecycle')
  lifecycle() {
    return {
      warmupDone: A_LIFECYCLE_LOG.length > 0 && B_LIFECYCLE_LOG.length > 0,
      log: [...A_LIFECYCLE_LOG, ...B_LIFECYCLE_LOG],
    };
  }

  /** A 通过构造注入（forwardRef）调用 B。 */
  @Get('a/ping')
  aPing() {
    return this.aService.ping();
  }

  /** B 通过 ModuleRef 反向调用 A。 */
  @Get('b/ping')
  bPing() {
    return this.bService.ping();
  }

  /** A 也用 ModuleRef 解析 B，对比两种注入方式。 */
  @Get('a/lazy')
  aLazy() {
    return this.aService.pingViaModuleRef();
  }
}

@Module({
  imports: [AModule, BModule],
  controllers: [AppController],
})
export class AppModule {}
