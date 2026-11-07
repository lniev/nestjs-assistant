import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

/**
 * 练习 s6-2 · e2e 测试与回归套件
 *
 * 统一的错误契约：所有异常都返回同一个形状，客户端只认 code 字段做分支，
 * 不用去猜 message 文案。e2e 断言「401 + code」才有意义。
 *
 *   {
 *     "statusCode": 401,
 *     "code": "AUTH_INVALID_CREDENTIALS",
 *     "message": "用户名或密码错误",
 *     "traceId": "tr-mfa2k-8x1",
 *     "path": "/auth/login",
 *     "timestamp": "2026-01-01T00:00:00.000Z"
 *   }
 *
 * 真实项目里喜欢用 nestjs 的 global filter + class-validator 的
 * exceptionFactory，把校验错误也变成同一个 code。
 */

export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_FORBIDDEN: 'ORDER_FORBIDDEN',
  ORDER_ITEMS_REQUIRED: 'ORDER_ITEMS_REQUIRED',
  ORDER_QUANTITY_INVALID: 'ORDER_QUANTITY_INVALID',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  traceId: string;
  path: string;
  timestamp: string;
}

/** traceId：优先用网关/客户端透传的 x-request-id，否则自行生成（真实项目接 OpenTelemetry）。 */
export function resolveTraceId(request: any): string {
  const header = request?.headers?.['x-request-id'];
  if (typeof header === 'string' && header.trim() !== '') return header.trim();
  return 'tr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** 把任意 exception 归一成错误契约。e2e 断言与 filter 共用，避免两套逻辑漂移。 */
export function toErrorEnvelope(exception: any, request: any): ErrorEnvelope {
  const statusCode =
    typeof exception?.getStatus === 'function' ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  const response = typeof exception?.getResponse === 'function' ? exception.getResponse() : null;

  let code: string = ERROR_CODES.INTERNAL_ERROR;
  let message = '服务器内部错误';

  if (response !== null && typeof response === 'object') {
    if (typeof (response as any).code === 'string') code = (response as any).code;
    const raw = (response as any).message;
    if (Array.isArray(raw)) message = raw.join('; ');
    else if (raw !== undefined && raw !== null) message = String(raw);
    else if (statusCode === HttpStatus.UNAUTHORIZED) code = 'AUTH_REQUIRED';
  } else if (typeof response === 'string') {
    message = response;
  }

  return {
    statusCode,
    code,
    message,
    traceId: resolveTraceId(request),
    path: String(request?.originalUrl ?? request?.url ?? ''),
    timestamp: new Date().toISOString(),
  };
}

/** 全局异常过滤器：在 AppModule 里用 APP_FILTER 注册（见 app.module.ts）。 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest();
    const response = context.getResponse();
    const envelope = toErrorEnvelope(exception, request);
    response.status(envelope.statusCode).json(envelope);
  }
}

/** 测试里构造 HttpException 的便捷函数（等价 new UnauthorizedException({ code, message })）。 */
export function httpError(status: number, code: string, message: string): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}
