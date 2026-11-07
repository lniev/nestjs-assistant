import { Injectable, NestMiddleware } from '@nestjs/common';

/** 演示用的用户信息；真实项目由 JWT / 会话解析得到。 */
export interface CurrentUserPayload {
  id: number;
  name: string;
  role: 'admin' | 'member' | 'guest';
}

const DEMO_USERS: Record<string, CurrentUserPayload> = {
  '1': { id: 1, name: 'Ada', role: 'admin' },
  '2': { id: 2, name: 'Linus', role: 'member' },
};

const GUEST: CurrentUserPayload = { id: 0, name: '访客', role: 'guest' };

/**
 * 认证中间件（教学版）：真实项目会在校验 JWT 之后把用户挂到 req.user 上。
 * 这里改为读取 x-user-id 请求头，未提供时回落到访客，保证请求台能直接调通。
 *
 * 同时生成 / 透传 requestId，让后面的 @RequestId() 有东西可读。
 * 中间件是「早于守卫/拦截器/管道」执行的最外层，最适合放这类请求级初始化。
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void): void {
    const rawId = String(req.headers?.['x-user-id'] ?? '').trim();
    req.user = DEMO_USERS[rawId] ?? GUEST;
    req.requestId = this.resolveRequestId(req.headers?.['x-request-id']);
    next();
  }

  private resolveRequestId(header: unknown): string {
    const value = String(header ?? '').trim();
    if (value !== '') return value;
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
}
