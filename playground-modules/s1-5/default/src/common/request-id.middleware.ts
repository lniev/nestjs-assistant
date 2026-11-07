import { Injectable, NestMiddleware } from '@nestjs/common';

/**
 * 请求生命周期第一站：中间件。
 *
 * - 在路由匹配之后、守卫之前执行，能拿到原始 req/res（没有 Nest 的管道/参数装饰器）。
 * - 这里从请求头 X-Request-Id 透传，没有就生成一个，挂到 req 上供后续组件使用。
 *
 * 真实项目通常换成 nestjs-pino / express-request-id，或者用 async_hooks 做链路追踪。
 * 本练习用最朴素的写法等价表达。
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private counter = 0;

  use(req: any, res: any, next: () => void): void {
    const incoming = req.headers ? req.headers['x-request-id'] : undefined;
    this.counter += 1;
    const requestId =
      typeof incoming === 'string' && incoming.trim() !== ''
        ? incoming.trim()
        : 'req-' + Date.now().toString(36) + '-' + this.counter;
    req.requestId = requestId;
    // 只挂到 req 上；写进响应头交给后面的拦截器，对比两者执行时机
    next();
  }
}
