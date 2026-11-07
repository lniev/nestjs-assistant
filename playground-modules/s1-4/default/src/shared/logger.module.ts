import { Injectable, Module } from '@nestjs/common';

/**
 * 共享 LoggerService：内存版日志收集器。
 *
 * 真实项目会换成 nestjs-pino / winston / 公司统一日志库；
 * 这里用内存数组等价表达，目的是演示「模块 exports + 跨模块注入」。
 */
@Injectable()
export class LoggerService {
  private readonly lines: string[] = [];

  log(message: string): void {
    this.lines.push(new Date().toISOString() + ' ' + message);
    // 只保留最近 50 条，防止无限增长
    if (this.lines.length > 50) this.lines.shift();
  }

  recent(): string[] {
    return this.lines.slice(-10);
  }
}

/**
 * 共享模块：对外 exports LoggerService，任何 import 它的模块都能注入。
 *
 * 对比：
 *   - 只在 providers 里注册 → 仅本模块可见
 *   - exports 出去 → 显式「共享」，但导入方仍需 import LoggerModule
 *   - @Global() → 全局模块，只需在根模块 import 一次（企业项目里要慎用）
 */
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
