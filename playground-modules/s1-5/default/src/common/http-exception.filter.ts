import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

/**
 * 全局异常过滤器：生命周期里最后一道关卡。
 *
 * 不管异常来自 handler 还是管道 / 守卫，这里都能拿到同一个 requestId，
 * 从而把「一次请求的所有错误」串起来 —— 这就是练习要求的可追踪性。
 *
 * 真实项目会换成统一错误码 + 日志上报（Sentry / OTel）。
 */
@Catch()
export class RequestIdExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      payload === null
        ? '服务器内部错误'
        : typeof payload === 'string'
          ? payload
          : (payload as { message?: unknown }).message ?? '请求失败';

    response.status(status).json({
      statusCode: status,
      message,
      requestId: request.requestId ?? null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
