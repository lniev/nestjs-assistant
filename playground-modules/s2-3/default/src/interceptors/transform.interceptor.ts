import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** 统一响应外壳：所有接口对外都长这样，前端只需要写一次解析逻辑。 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  traceId: string;
  durationMs: number;
  timestamp: number;
}

/**
 * 统一响应拦截器：用 RxJS 的 map 改写 next.handle() 返回的响应流。
 *
 * 关键点：
 *   - next.handle() 才是「执行处理器」的入口，不调用它处理器不会执行；
 *   - map 的回调在处理器返回后才执行，所以能在这里计算耗时；
 *   - traceId 优先复用上游网关注入的 x-trace-id 请求头，没有就自己生成，
 *     并把同一个值写回 request，方便日志/异常过滤器复用；
 *   - 关于序列化（application/serialization）：Nest 默认用 JSON.stringify 序列化返回值，
 *     真实项目常配合 class-transformer 的 @Exclude()/@Expose() 做字段过滤与分组，
 *     操练场没有该依赖，这里用普通对象表达同样的「统一外壳」思路。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    // switchToHttp() 只适用于 HTTP；RPC/WS 场景要用 switchToRpc()/switchToWs()
    const request = context.switchToHttp().getRequest<any>();
    const traceId = this.resolveTraceId(request);
    request.traceId = traceId;

    const startedAt = Date.now();
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'ok',
        data,
        traceId,
        // 从进入拦截器到响应流发出数据的耗时，包含处理器执行时间
        durationMs: Date.now() - startedAt,
        timestamp: startedAt,
      })),
    );
  }

  private resolveTraceId(request: any): string {
    const header = String(request?.headers?.['x-trace-id'] ?? '').trim();
    if (header !== '') return header;
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}
