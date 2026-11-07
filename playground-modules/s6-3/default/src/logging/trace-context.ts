declare const require: any;

/**
 * 请求级上下文（traceId / method / path）。
 *
 * 为什么要 AsyncLocalStorage：日志散落在 controller、service、拦截器里，
 * 逐层把 traceId 当参数传下去会污染所有方法签名。ALS 让「当前异步调用链」
 * 自己带着上下文，任意位置都能取到。
 *
 * 真实项目：OpenTelemetry（@opentelemetry/sdk-node + @nestjs/otel）会做同样的事，
 * 并兼容 W3C 的 traceparent 头；Node 内置的 async_hooks 就是它的底座。
 */
const { AsyncLocalStorage } = require('node:async_hooks');

export interface TraceContext {
  traceId: string;
  method?: string;
  path?: string;
}

const storage = new AsyncLocalStorage();
let counter = 0;

/**
 * 生成 traceId。真实项目优先沿用网关透传的 traceparent / x-request-id，
 * 保证跨服务能串起来；这里用「时间戳 + 自增 + 随机」避免引入 uuid 依赖。
 */
export function createTraceId(): string {
  counter = (counter + 1) % 1679616;
  return (
    'tr-' +
    Date.now().toString(36) +
    '-' +
    counter.toString(36).padStart(2, '0') +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

/** 在指定上下文里执行一段逻辑（中间件里包住 next()）。 */
export function runWithTrace<T>(context: TraceContext, run: () => T): T {
  return storage.run(context, run);
}

export function currentTrace(): TraceContext | null {
  return storage.getStore() ?? null;
}

/** 日志里用的 traceId；不在请求上下文里（如启动阶段）返回 null。 */
export function currentTraceId(): string | null {
  const context = currentTrace();
  return context === null ? null : context.traceId;
}
