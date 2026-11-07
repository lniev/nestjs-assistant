import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

/** 超过这个毫秒数就按「慢请求」用 warn 级别记录（运行日志里能直接看到）。 */
const SLOW_REQUEST_MS = 50;

/**
 * 耗时日志拦截器：next.handle() 返回的 Observable 就是「响应流」，
 * 用 RxJS 操作符在成功 / 失败两条路径上埋点。
 *
 * 关键点：
 *   - tap 只在成功路径触发；失败路径必须用 catchError；
 *   - catchError 里要 return throwError(() => error) 原样抛回去，
 *     否则异常被吞掉，全局异常过滤器（见 s2-4）就收不到；
 *   - 真实项目把这类日志接到 OpenTelemetry / pino，而不是手写 console。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<any>();
    const method = String(request?.method ?? 'GET');
    const url = String(request?.originalUrl ?? request?.url ?? '');
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => this.writeLog(method, url, Date.now() - startedAt, null)),
      catchError((error) => {
        this.writeLog(method, url, Date.now() - startedAt, error);
        return throwError(() => error);
      }),
    );
  }

  private writeLog(
    method: string,
    url: string,
    ms: number,
    error: unknown,
  ): void {
    const line = method + ' ' + url + ' ' + ms + 'ms';
    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('[fail] ' + line + ' -> ' + message);
      return;
    }
    if (ms >= SLOW_REQUEST_MS) {
      // runner 只打开了 error/warn 级别日志，所以慢请求用 warn 才能在运行日志里看到
      this.logger.warn('[slow] ' + line);
    } else {
      this.logger.debug(line);
    }
  }
}
