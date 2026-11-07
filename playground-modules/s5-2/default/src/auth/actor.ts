import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * 练习 s5-2 · 授权：策略与 RBAC
 *
 * 这一层只做两件事：解析「身份」，校验「角色」。
 *   - 401 Unauthorized：根本不知道你是谁（没有凭证）。
 *   - 403 Forbidden：知道你是谁，但角色 / 归属不允许这个操作。
 *
 * 真实项目里身份来自 JWT：@nestjs/jwt + @nestjs/passport 的 AuthGuard('jwt')
 * 把 payload 挂到 request.user；角色检查用 RolesGuard + @Roles()；
 * 记录级权限（谁能改哪条订单）用 CASL（@casl/ability）或手写 policy 类。
 * 操练场不联网、也没装这些包，所以这里用「内存用户表 + ?as= 模拟登录态」。
 */
export type Role = 'customer' | 'staff' | 'admin';

export interface Actor {
  id: number;
  name: string;
  role: Role;
}

export const ROLES_KEY = 'roles';

/** 内存用户表：真实项目里由用户服务 / 数据库提供。 */
export const USERS: Actor[] = [
  { id: 1, name: 'alice', role: 'customer' },
  { id: 2, name: 'bob', role: 'customer' },
  { id: 9, name: 'staff', role: 'staff' },
  { id: 10, name: 'admin', role: 'admin' },
];

/**
 * 解析「当前登录用户」。
 * 真实项目：从 Authorization: Bearer <jwt> 解出 payload 再查库。
 * 操练场为了方便用请求台验证，允许 header x-user-id 或 query ?as=1。
 */
export function resolveActor(request: any): Actor | null {
  const rawId = request.headers['x-user-id'] ?? request.query?.as;
  const userId = Number(rawId);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return USERS.find((user) => user.id === userId) ?? null;
}

/** 在 controller 里取当前用户：@Actor() actor: Actor —— 等价于 @Req() 后取 req.user。 */
export const Actor = createParamDecorator((_data: unknown, context: ExecutionContext): Actor => {
  return context.switchToHttp().getRequest().actor;
});

/** 只负责 401：没有身份直接拒绝（未登录）。 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.actor = resolveActor(request);
    if (request.actor === null) {
      // 真实项目里由 AuthGuard('jwt') 抛出；错误体带 code 便于客户端区分原因。
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: '请先登录（header x-user-id 或 query ?as=1）',
      });
    }
    return true;
  }
}

/** 标记这条路由要求哪些角色：@Roles('staff', 'admin')。 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * 只负责 403：身份存在但角色不匹配。
 * 它依赖 AuthenticatedGuard 先跑（401 优先于 403），所以成对使用：
 *   @UseGuards(AuthenticatedGuard, RolesGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const actor: Actor = context.switchToHttp().getRequest().actor;
    if (!actor || required.indexOf(actor.role) < 0) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: '当前角色无权访问该资源',
      });
    }
    return true;
  }
}
