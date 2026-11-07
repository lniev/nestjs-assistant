import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { JsonLoggerService } from './json-logger.service';
import { createTraceId, currentTrace, runWithTrace } from './trace-context';

/** 超过这个耗时就打 warn（真实项目按 P99 定阈值，并配告警规则）。 */
export const SLOW_REQUEST_MS = 300;

/**
 * 请求上下文中间件：给每个请求生成/透传 traceId，写回 X-Trace-Id 响应头，
 * 并用 AsyncLocalStorage 把上下文包住整条调用链。
 *
 * 在 bootstrap.ts 里用 app.use(traceMiddleware) 注册（全局生效）。
 * 真实项目：OpenTelemetry 的 HTTP instrumentation 会自动读取 W3C traceparent。
 */
export function traceMiddleware(request: any, response: any, next: () => void): void {
  const incoming = request.headers?.['x-request-id'] ?? request.headers?.['traceparent'];
  const traceId = typeof incoming === 'string' && incoming.trim() !== '' ? incoming.trim() : createTraceId();
  response.setHeader('X-Trace-Id', traceId);
  const context = {
    traceId,
    method: String(request.method ?? 'GET'),
    path: String(request.originalUrl ?? request.url ?? '/'),
  };
  runWithTrace(context, () => next());
}

/** 指标聚合（真实项目用 prom-client 暴露 /metrics 给 Prometheus 抓取）。 */
@Injectable()
export class MetricsService {
  private readonly routes = new Map<string, { count: number; totalMs: number; slowCount: number }>();

  record(method: string, path: string, status: number, durationMs: number): void {
    const key = method + ' ' + path + ' ' + status;
    const current = this.routes.get(key) ?? { count: 0, totalMs: 0, slowCount: 0 };
    current.count += 1;
    current.totalMs += durationMs;
    if (durationMs >= SLOW_REQUEST_MS) current.slowCount += 1;
    this.routes.set(key, current);
  }

  snapshot() {
    return {
      slowThresholdMs: SLOW_REQUEST_MS,
      routes: Array.from(this.routes.entries()).map(([key, value]) => ({
        key,
        count: value.count,
        avgMs: value.count === 0 ? 0 : Math.round(value.totalMs / value.count),
        slowCount: value.slowCount,
      })),
      note: '真实项目接入 prom-client：histogram 记录耗时、counter 记录状态码，/metrics 给 Prometheus 抓取',
    };
  }
}

/**
 * 请求日志拦截器：记录开始/结束（带耗时），超过阈值打 warn。
 * 注册方式：AppModule providers 里的 APP_INTERCEPTOR。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: JsonLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const trace = currentTrace();
    const method = String(trace?.method ?? request.method ?? 'GET');
    const path = String(trace?.path ?? request.originalUrl ?? request.url ?? '/');
    const startedAt = Date.now();

    this.logger.log('request.start', 'HTTP', { method, path });

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startedAt;
        const status = context.switchToHttp().getResponse().statusCode;
        this.metrics.record(method, path, status, durationMs);
        if (durationMs >= SLOW_REQUEST_MS) {
          this.logger.warn('request.slow', 'HTTP', { method, path, status, durationMs });
        }
        this.logger.log('request.end', 'HTTP', { method, path, status, durationMs });
      }),
    );
  }
}
