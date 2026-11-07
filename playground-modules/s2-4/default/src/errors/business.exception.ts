import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 机器可读错误码表：客户端按 code 分支，不依赖 message 文案。
 * 真实项目通常由后端统一维护（例如 ORDER_EMPTY = 40001）。
 */
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  ORDER_EMPTY: 'ORDER_EMPTY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * 业务异常：继承 HttpException，用对象作为 response 把 code 一起带进响应体。
 * （Nest 内置过滤器会原样序列化这个对象；我们的 AllExceptionsFilter 会再包一层，
 * 保证成功响应与失败响应形状一致。）
 */
export class BusinessException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}
