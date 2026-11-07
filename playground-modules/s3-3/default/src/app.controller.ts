import { Controller, Get } from '@nestjs/common';
import {
  AuditService,
  RequestIdFormatter,
  RequestScopedAuditService,
} from './audit/audit.service';
import { RequestContextService } from './context/request-context';

/**
 * 注意：因为注入了 REQUEST 作用域的 RequestScopedAuditService，
 * 这个控制器也会被「作用域冒泡」成请求级 —— 这正是请求作用域的成本所在。
 */
@Controller()
export class AppController {
  constructor(
    private readonly audit: AuditService,
    private readonly requestScopedAudit: RequestScopedAuditService,
    private readonly context: RequestContextService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's3-3' };
  }

  /** 一次请求里，service 深处直接读 ALS 里的 traceId / userId，全程不传参。 */
  @Get('audit/whoami')
  whoami() {
    return {
      ...this.audit.record('whoami'),
      requestScoped: this.requestScopedAudit.marker,
      alsTraceId: this.context.traceId,
      hint: '请求头 x-trace-id / x-user-id 可以覆盖默认值；响应头也会带 x-trace-id',
    };
  }

  /** 对比三种作用域的实例数。 */
  @Get('audit/stats')
  stats() {
    return {
      // DEFAULT：恒为 1，不随请求增长
      singletonInstances: AuditService.instances,
      // TRANSIENT：每个消费者一份（AuditService + AuditReportService = 2），也不随请求增长
      transientInstances: RequestIdFormatter.instances,
      // REQUEST：每请求 +1
      requestScopedInstances: RequestScopedAuditService.instances,
      currentTraceId: this.context.traceId,
      currentUserId: this.context.userId,
    };
  }
}
