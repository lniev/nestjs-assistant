import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

/**
 * 练习 s2-3 · 拦截器与统一响应
 *
 * 这套默认代码演示两个全局拦截器（用 APP_INTERCEPTOR 注册，因此支持依赖注入）：
 *   - LoggingInterceptor：记录方法、路径与耗时，慢请求用 warn 级别写日志；
 *   - TransformInterceptor：把处理器返回值统一包装成
 *     { code, message, data, traceId, durationMs, timestamp }。
 *
 * 建议动手：
 *   1. 把 /users 的返回值改成字符串 / Promise / Observable，观察统一包装结果；
 *   2. 交换下面两个 APP_INTERCEPTOR 的注册顺序，理解洋葱模型「谁先进、谁后出」；
 *   3. 把 TransformInterceptor 里的 code 改成业务码（比如 1000），把慢请求阈值调低。
 */
@Module({
  controllers: [AppController],
  providers: [
    // 注册顺序 = 执行顺序：越靠前越「外层」，先进入、后离开。
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
