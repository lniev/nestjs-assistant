import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

/**
 * 练习 s2-4 · 异常过滤器与错误契约
 *
 * 这套默认代码用一个 @Catch() 全局过滤器接管所有异常，对外统一返回：
 *   { success: false, code, message, traceId, timestamp }
 *
 * 建议动手：
 *   1. 访问 /boom，对比「注释掉 APP_FILTER」前后的响应体差异；
 *   2. 给过滤器加一个 response header（如 x-error-code），或按 code 映射不同文案；
 *   3. 把 /orders 的 BusinessException 改成 BadRequestException，观察兜底错误码的变化。
 */
@Module({
  controllers: [AppController],
  providers: [
    // APP_FILTER 注册的全局过滤器支持依赖注入（可以注入 Logger、配置、埋点服务）。
    // 也可以 bootstrap.ts 里 app.useGlobalFilters(new AllExceptionsFilter())，
    // 但那样子类无法注入依赖，仅适合无依赖的过滤器。
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
