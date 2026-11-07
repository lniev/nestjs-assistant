import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { RequestContextService } from '../context/request-context';

/**
 * TRANSIENT 作用域：不跨消费者共享，每个注入它的 provider 都得到独立实例。
 * 用来演示「作用域三件套」里最少见的一种：它不会冒泡（不影响消费者的作用域），
 * 也不会被单例缓存复用。
 */
@Injectable({ scope: Scope.TRANSIENT })
export class RequestIdFormatter {
  static instances = 0;

  constructor() {
    RequestIdFormatter.instances += 1;
  }

  format(requestId: string): string {
    return '[' + requestId + ']';
  }
}

/**
 * 单例审计服务（DEFAULT 作用域）：
 * 依赖链再深也不用把 traceId / userId 一层层传参，直接从 ALS 里读。
 * 静态计数器证明它只被创建一次，不随请求增长。
 */
@Injectable()
export class AuditService {
  static instances = 0;

  constructor(
    private readonly context: RequestContextService,
    // 消费者之一：拿到自己专属的 transient 实例
    private readonly formatter: RequestIdFormatter,
  ) {
    AuditService.instances += 1;
  }

  record(action: string) {
    return {
      action,
      traceId: this.formatter.format(this.context.traceId),
      userId: this.context.userId,
      singletonInstances: AuditService.instances,
    };
  }
}

/**
 * 另一个单例消费者：它也注入 RequestIdFormatter，因此会再拿到一份独立实例。
 * 两个消费者 → RequestIdFormatter.instances 恒为 2，与请求次数无关。
 */
@Injectable()
export class AuditReportService {
  constructor(private readonly formatter: RequestIdFormatter) {}

  describe(traceId: string) {
    return { reportTraceId: this.formatter.format(traceId) };
  }
}

/**
 * 对比组：REQUEST 作用域的 provider。
 * 每个请求都会重新构造实例；注入它的控制器也会被「作用域冒泡」成请求级，
 * 每个请求都要重建相关对象 —— 这就是官方建议优先用 ALS / durable provider 的原因。
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedAuditService {
  static instances = 0;

  constructor(@Inject(REQUEST) private readonly request: any) {
    RequestScopedAuditService.instances += 1;
  }

  get marker() {
    return {
      requestScopedInstances: RequestScopedAuditService.instances,
      // 请求级 provider 能直接拿到原生请求对象，但有实例化成本
      userIdFromRequest: String(
        this.request?.headers?.['x-user-id'] ?? 'anonymous',
      ),
    };
  }
}
