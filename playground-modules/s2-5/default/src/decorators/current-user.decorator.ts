import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUserPayload } from '../middleware/auth.middleware';

/**
 * @CurrentUser()        → 整个用户对象
 * @CurrentUser('role')  → 只取 user 的某个字段（data 参数就是调用装饰器时传的值）
 *
 * 关键点：
 *   - createParamDecorator 的回调签名是 (data, ctx)，data 的类型要自己标注；
 *   - ctx.switchToHttp().getRequest() 拿原生请求；RPC / WebSocket 场景分别用
 *     ctx.switchToRpc() / ctx.switchToWs()，这就是 ExecutionContext 的价值；
 *   - 取不到 user 时返回 undefined，由业务决定是否抛 UnauthorizedException。
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<any>();
    const user = request?.user as CurrentUserPayload | undefined;
    if (!user) return undefined;
    // 支持 @CurrentUser('role') 这种「只取某字段」的用法
    return data ? user[data] : user;
  },
);
