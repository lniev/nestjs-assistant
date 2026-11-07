import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/** 角色元数据的 key，供 @Roles 与 Reflector 共用。 */
export const ROLES_KEY = 'roles';

export type Role = 'admin' | 'user';

/**
 * 自定义装饰器：把「访问该路由需要的角色」写进元数据。
 * 等价于官方文档的 Roles(...roles: Role[])，也常配合 @Public() 使用。
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * 演示用的 token → 角色映射。
 * 真实项目绝不会这样写在代码里：会用 JWT / OAuth2 校验签名后得到 user。
 */
const TOKEN_ROLES: Record<string, Role> = {
  'admin-token': 'admin',
  'user-token': 'user',
};

/**
 * 角色守卫：守卫只负责「放行 / 拒绝」，不修改请求数据。
 *
 * 执行顺序：middleware → guards → interceptors → pipes → handler，
 * 所以被守卫拒绝的请求不会走到参数校验，更不会进入控制器。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // getAllAndOverride：方法级 @Roles 优先于类级 @Roles
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 没标注 @Roles = 公开路由，直接放行
    if (required === undefined || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers ? request.headers['authorization'] : undefined;
    const raw = typeof authorization === 'string' ? authorization : '';
    const token = raw.replace(/^Bearer\s+/i, '').trim();

    if (token === '') throw new UnauthorizedException('缺少 Authorization: Bearer <token>');

    const role = TOKEN_ROLES[token];
    if (role === undefined) throw new UnauthorizedException('token 无效');

    if (required.indexOf(role) < 0) {
      throw new ForbiddenException('需要角色：' + required.join(' / ') + '，当前角色：' + role);
    }

    // 把登录者挂到 request 上，后续可用 @Req() 或自定义装饰器读取（s1-5 的 RequestId 同理）
    request.user = { role, token };
    return true;
  }
}
