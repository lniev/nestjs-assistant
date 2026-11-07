import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { PublicUser } from './user.repository';

/**
 * 练习 s5-1 · 全局认证守卫
 *
 * 真实项目：AuthGuard('jwt')（@nestjs/passport + passport-jwt），配合 @Public() 跳过。
 * 这里手写等价物：
 *   - 从 Authorization: Bearer <token> 取 accessToken；
 *   - 交给 AuthService 校验签名、过期时间与服务端会话状态；
 *   - 通过后把 user/sessionId 挂到 request 上，供 @CurrentUser() 读取。
 *
 * 全局注册见 AppModule：{ provide: APP_GUARD, useClass: AuthGuard }。
 * 想跳过某个路由就用 @Public()。
 */

export const IS_PUBLIC_KEY = 'auth:public';

/** 标记公开路由（不需要登录）。 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  user?: PublicUser;
  sessionId?: string;
}

/** 参数装饰器：从 request 上取回守卫放入的当前用户。 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser | undefined => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (token === null) {
      throw new UnauthorizedException('缺少 Bearer 访问令牌（Authorization: Bearer <token>）');
    }

    const { user, sessionId } = await this.authService.verifyAccessToken(token);
    request.user = user;
    request.sessionId = sessionId;
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const header = request.headers?.authorization;
    const headerValue = Array.isArray(header) ? header[0] : String(header ?? '');
    const [scheme, value] = headerValue.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && value) return value;

    // 操练场请求台不方便加 Header 时，可用 ?access_token=xxx 演示；真实项目只认 Authorization 头。
    const queryToken = request.query?.access_token;
    return typeof queryToken === 'string' && queryToken !== '' ? queryToken : null;
  }
}
