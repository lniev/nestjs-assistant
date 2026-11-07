import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { LoggingInterceptor, MetricsService } from './logging/http-observer';
import { JsonLoggerService } from './logging/json-logger.service';

/**
 * 练习 s6-3 · 结构化日志与可观测性
 *
 * 结构：
 *   logging/trace-context.ts     AsyncLocalStorage 请求上下文 + traceId 生成
 *   logging/json-logger.service.ts JSON LoggerService（字段规范 + 敏感字段脱敏 + 环形缓冲）
 *   logging/http-observer.ts     traceId 中间件 + 请求耗时拦截器 + 指标聚合
 *   bootstrap.ts                 app.use(traceMiddleware) + app.useLogger(JsonLoggerService)
 *   app.controller.ts            /logger/*、/logs、/metrics 演示接口
 *
 * 建议动手：
 *   1. GET /logger/demo 拿到 traceId，再访问 /logs?traceId=… 看同一请求的全部日志；
 *   2. GET /logger/redact，确认 password/token 在日志里是 [REDACTED]；
 *   3. 把 SLOW_REQUEST_MS 改成 1，重新访问任一接口，/metrics 里出现 slowCount。
 *
 * 真实项目：nestjs-pino 输出 JSON、OpenTelemetry 注入 traceId、prom-client 暴露 /metrics。
 */
@Module({
  controllers: [AppController],
  providers: [
    JsonLoggerService,
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
