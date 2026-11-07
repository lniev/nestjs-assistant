import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';

/** 每个请求独立的上下文数据。 */
export interface RequestContext {
  traceId: string;
  userId: string;
  startedAt: number;
}

/** ALS 实例的注入令牌（Symbol 令牌，避免和业务令牌撞名）。 */
export const REQUEST_CONTEXT_STORAGE = Symbol('REQUEST_CONTEXT_STORAGE');

export type RequestContextStorage = AsyncLocalStorage<RequestContext>;

/**
 * 请求上下文服务：把 Node 的 AsyncLocalStorage 封装成 Nest provider。
 *
 * 真实项目首选成熟方案：
 *   - nestjs-cls：ClsModule.forRoot() + ClsService（支持 middleware.mount、强类型 store）；
 *   - @nestjs/observe：内置 TracerService，HTTP / GraphQL / gRPC / cron 都有 trace 上下文。
 * 操练场没装这些包，这里用手写 ALS 等价表达，原理是同一套 async_hooks。
 */
@Injectable()
export class RequestContextService {
  constructor(
    @Inject(REQUEST_CONTEXT_STORAGE)
    private readonly storage: RequestContextStorage,
  ) {}

  /** 在中间件里调用：让回调（整条请求链）共享同一个 store。 */
  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get current(): RequestContext | undefined {
    return this.storage.getStore();
  }

  get traceId(): string {
    return this.storage.getStore()?.traceId ?? 'no-trace';
  }

  get userId(): string {
    return this.storage.getStore()?.userId ?? 'anonymous';
  }

  /** 业务里可以随时补写字段（真实项目建议只暴露少量写方法，避免隐式全局状态）。 */
  update(patch: Partial<RequestContext>): void {
    const store = this.storage.getStore();
    if (store) Object.assign(store, patch);
  }
}

/**
 * 中间件：在请求最外层创建 store。
 * 必须在这里 als.run(...) 包裹 next()，之后的 guard / interceptor / handler
 * 以及它们 await 出来的异步调用链都能 getStore() 到同一份数据。
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(req: any, res: any, next: () => void): void {
    const traceId = this.resolveTraceId(req.headers?.['x-trace-id']);
    const userId =
      String(req.headers?.['x-user-id'] ?? '').trim() || 'anonymous';
    if (typeof res?.setHeader === 'function') res.setHeader('x-trace-id', traceId);
    this.context.run({ traceId, userId, startedAt: Date.now() }, () => next());
  }

  private resolveTraceId(header: unknown): string {
    const value = String(header ?? '').trim();
    if (value !== '') return value;
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
}
