import { Controller, Get, Query } from '@nestjs/common';
import { JsonLoggerService } from './logging/json-logger.service';
import { MetricsService } from './logging/http-observer';
import { currentTraceId } from './logging/trace-context';

/**
 * 可观测性演示接口：
 *   GET /logger/demo      一次请求里打 3 条日志，返回 traceId
 *   GET /logger/redact    故意把 password/token 传给 logger，看脱敏结果
 *   GET /logs?traceId=…   按 traceId 查回整条链路的日志
 *   GET /metrics          请求计数与慢请求统计
 *
 * 真实项目里日志进 Loki/ELK，trace 进 Jaeger/Tempo，指标进 Prometheus（/metrics）。
 */
@Controller()
export class AppController {
  constructor(
    private readonly logger: JsonLoggerService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('health')
  health() {
    this.logger.log('health.checked', 'HealthController', { module: 's6-3' });
    return { status: 'ok', module: 's6-3', traceId: currentTraceId(), responseHeader: 'X-Trace-Id' };
  }

  /** 模拟一次下单：三条日志（info/info/warn）共享同一个 traceId。 */
  @Get('logger/demo')
  demo(@Query('userId') userId?: string) {
    const traceId = currentTraceId();
    const orderId = 'ord-1001';
    this.logger.log('order.created', 'OrdersService', { orderId, userId: userId ?? 'anonymous' });
    this.logger.log('payment.requested', 'PaymentService', { orderId, provider: 'mock-pay' });
    this.logger.warn('order.audit', 'AuditService', { orderId, note: 'warn 级别也带同一个 traceId' });
    return {
      traceId,
      orderId,
      hint: '用 GET /logs?traceId=' + String(traceId) + ' 查这一次请求的全部日志',
    };
  }

  /** 演示敏感字段脱敏：password/token/authorization 落库前变成 [REDACTED]。 */
  @Get('logger/redact')
  redact() {
    const traceId = currentTraceId();
    this.logger.log('auth.login', 'AuthService', {
      username: 'alice',
      password: 'p@ssw0rd',
      token: 'tok-live-123',
      authorization: 'Bearer tok-live-123',
      nested: { refreshToken: 'rt-live-456', safe: 'keep-me' },
    });
    const entries = this.logger.recent(traceId).filter((entry) => entry.msg === 'auth.login');
    return { traceId, entries, note: 'password/token/authorization/refreshToken 已变成 [REDACTED]' };
  }

  @Get('logs')
  logs(@Query('traceId') traceId?: string) {
    const entries = this.logger.recent(typeof traceId === 'string' && traceId !== '' ? traceId : undefined);
    return {
      traceId: traceId ?? null,
      count: entries.length,
      entries,
      buffer: this.logger.stats(),
      note: '内存环形缓冲只保留最近 200 条；真实项目查 Loki/ELK，按 traceId 关联',
    };
  }

  @Get('metrics')
  metricsSnapshot() {
    return this.metrics.snapshot();
  }
}
