import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { AppController } from './app.controller';
import {
  AuditReportService,
  AuditService,
  RequestIdFormatter,
  RequestScopedAuditService,
} from './audit/audit.service';
import {
  REQUEST_CONTEXT_STORAGE,
  RequestContextMiddleware,
  RequestContextService,
} from './context/request-context';

/**
 * 练习 s3-3 · 作用域与请求上下文
 *
 * 一次看全三种作用域（provider 旁有注释）：
 *   DEFAULT  —— AuditService 单例：全程只创建一次；
 *   TRANSIENT—— RequestIdFormatter：每个消费者各一份，本例两个消费者 → 恒为 2 个；
 *   REQUEST  —— RequestScopedAuditService：每请求新建，还会沿注入链冒泡，成本更高。
 * 以及本模块主打的请求级上下文方案 —— AsyncLocalStorage：
 * 单例服务从 ALS 读 traceId / userId，零传参、零额外实例。
 *
 * 建议动手：
 *   1. 连续请求 /audit/stats 两三次，观察 requestScopedInstances 每次 +1，
 *      singletonInstances / transientInstances 保持不变；
 *   2. 把中间件里 als.run 换成 enterWith，理解两者的区别（enterWith 会污染后续上下文）；
 *   3. 在 audit.service.ts 里加一个深层调用（service → helper → service），验证 ALS 依然能读到数据。
 */
@Module({
  controllers: [AppController],
  providers: [
    // 把 ALS 实例注册成 value provider，任何 provider 都能注入它
    { provide: REQUEST_CONTEXT_STORAGE, useValue: new AsyncLocalStorage() },
    RequestContextService,
    // DEFAULT：单例，全程只创建一次
    AuditService,
    // TRANSIENT：每个消费者各一份实例（AuditService 与 AuditReportService 各一个）
    RequestIdFormatter,
    AuditReportService,
    // REQUEST：每个请求新建，并沿注入链向上冒泡
    RequestScopedAuditService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // '*path' 是 Nest 11 / Express 5 的具名通配写法（旧版本可以写 '*'）。
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
