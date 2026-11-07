import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { RequestIdExceptionFilter } from './common/http-exception.filter';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { RequestIdInterceptor } from './common/request-id.interceptor';

/**
 * 练习 s1-5 · 请求生命周期与中间件
 *
 * 一次请求在 Nest 里的顺序：
 *   middleware → guards → interceptors（前半段）→ pipes → handler
 *   → interceptors（后半段）→ exception filters
 *
 * 本模块分别用到了四类组件里的三类：
 *   - RequestIdMiddleware：给每个请求分配 requestId（挂在 AppController 的所有路由上）
 *   - RequestIdInterceptor：写响应头 X-Request-Id，并统计 handler 耗时
 *   - RequestIdExceptionFilter：异常响应里带上同一个 requestId
 *
 * 建议动手：
 *   1. 请求 /boom，对比正常响应与异常响应里的 requestId 是否一致。
 *   2. 在 middleware 里把 console.log 改成记录 req.method / req.url。
 *   3. 再加一个全局 Guard（s2-2 会讲），观察它比中间件更晚执行、但比管道更早。
 *
 * 真实项目常用 forRoutes('*') 挂全局中间件；这里用 forRoutes(AppController)
 * 等价表达（Nest 11 + Express 5 下 '*' 已改成具名通配符 {*path}）。
 */
@Module({
  controllers: [AppController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_FILTER, useClass: RequestIdExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes(AppController);
  }
}
