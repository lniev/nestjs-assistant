import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BusinessException, ERROR_CODES } from '../errors/business.exception';

/** HTTP 状态码 → 稳定错误码的兜底映射（业务异常的 code 会覆盖它）。 */
const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
};

interface ErrorBody {
  success: false;
  code: string;
  message: string;
  traceId: string;
  timestamp: string;
}

/**
 * 全局兜底异常过滤器：@Catch() 不写参数表示捕获「所有」异常。
 *
 * 三条纪律：
 *   1. 对客户端：永远返回稳定的 { success, code, message, traceId, timestamp }；
 *      未知异常的 message 固定为「服务器内部错误」，绝不把堆栈、SQL、文件路径带出去；
 *   2. 对服务端：未知异常用 Logger.error 记录完整堆栈，方便排查；
 *   3. HttpException 属于「预期内错误」，直接复用它的状态码与业务文案。
 *
 * 真实项目里常用 APP_FILTER 注册（见 AppModule），并继承 BaseExceptionFilter
 * 兜住边缘场景；另外要注意：中间件里抛出的异常只有全局过滤器能捕获。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<any>();
    const response = http.getResponse<any>();

    const traceId =
      String(request?.headers?.['x-trace-id'] ?? '').trim() || createTraceId();
    const described = this.describe(exception);

    if (described.status >= 500) {
      // 只写日志，不进响应体：这是「不泄漏内部细节」的关键一行。
      const stack =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        '[' +
          String(request?.method ?? '') +
          ' ' +
          String(request?.url ?? '') +
          '] ' +
          described.message +
          '\n' +
          String(stack ?? ''),
      );
    }

    const body: ErrorBody = {
      success: false,
      code: described.code,
      message: described.message,
      traceId,
      timestamp: new Date().toISOString(),
    };
    response.status(described.status).json(body);
  }

  private describe(exception: unknown): {
    status: number;
    code: string;
    message: string;
  } {
    if (exception instanceof BusinessException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      // 自定义异常可以传 { code, message } 对象，优先使用它的 code。
      if (
        payload &&
        typeof payload === 'object' &&
        typeof (payload as any).code === 'string'
      ) {
        return {
          status,
          code: (payload as any).code,
          message: this.extractMessage(payload, exception.message),
        };
      }
      return {
        status,
        code: STATUS_CODE_MAP[status] ?? 'HTTP_' + String(status),
        message: this.extractMessage(payload, exception.message),
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: '服务器内部错误，请稍后重试',
    };
  }

  /** HttpException 的 response 可能是字符串、{ message }，或校验失败时的 { message: string[] }。 */
  private extractMessage(payload: unknown, fallback: string): string {
    if (typeof payload === 'string' && payload.trim() !== '') return payload;
    if (payload && typeof payload === 'object') {
      const message = (payload as any).message;
      if (typeof message === 'string' && message.trim() !== '') return message;
      if (Array.isArray(message) && message.length > 0) {
        return message.map(String).join('; ');
      }
    }
    return fallback;
  }
}

function createTraceId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
