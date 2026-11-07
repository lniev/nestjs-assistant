import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

/**
 * 拦截器：在守卫之后、管道之前进入，handler 返回后再执行后半段。
 *
 * 这里演示两件常用的事：
 *   1. 把中间件挂到 req 上的 requestId 写进响应头 X-Request-Id；
 *   2. 用 finalize 统计一次请求的耗时（成功/异常都会执行）。
 *
 * 真实项目里 interceptors 常用来做统一响应包装、超时、缓存、埋点。
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const startedAt = Date.now();
    const requestId = request.requestId;

    if (requestId !== undefined && typeof response.setHeader === 'function') {
      response.setHeader('X-Request-Id', String(requestId));
    }
    console.log('[interceptor] 进入 ' + request.method + ' ' + request.url + ' requestId=' + String(requestId));

    return next.handle().pipe(
      finalize(() => {
        console.log('[interceptor] 完成 ' + (Date.now() - startedAt) + 'ms requestId=' + String(requestId));
      }),
    );
  }
}
