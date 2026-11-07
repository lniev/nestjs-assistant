import { Body, Controller, Get, Injectable, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-contract';

/** 内存用户表：真实项目查库 + bcrypt 校验，成功后签发 JWT（@nestjs/jwt）。 */
const DEMO_USERS = [
  { id: 1, username: 'alice', password: 's3cret', role: 'customer' },
  { id: 2, username: 'bob', password: 'hunter2', role: 'customer' },
  { id: 9, username: 'staff', password: 'staff123', role: 'staff' },
];

export interface AuthActor {
  userId: number;
  username: string;
  role: string;
}

interface TokenRecord extends AuthActor {
  token: string;
}

/**
 * 认证服务：真实项目里这里返回 accessToken（JWT），
 * e2e 的登录失败用例断言 401 + code，登录成功用例拿 token 继续调受保护接口。
 */
@Injectable()
export class AuthService {
  private readonly tokens = new Map<string, TokenRecord>();
  private counter = 0;

  login(username: string, password: string): { token: string; user: AuthActor } {
    const user = DEMO_USERS.find((item) => item.username === username && item.password === password);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: '用户名或密码错误',
      });
    }
    this.counter += 1;
    const token = 'tok-' + this.counter.toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const actor: AuthActor = { userId: user.id, username: user.username, role: user.role };
    this.tokens.set(token, { token, ...actor });
    return { token, user: actor };
  }

  /** BearerGuard 用：校验 token 并返回 actor，无效返回 null（由 guard 抛 401）。 */
  validate(token: string): AuthActor | null {
    const record = this.tokens.get(String(token ?? ''));
    if (!record) return null;
    return { userId: record.userId, username: record.username, role: record.role };
  }

  activeTokenCount(): number {
    return this.tokens.size;
  }
}

/**
 * 登录接口（被 e2e 覆盖的主链路起点）：
 *   POST /auth/login {"username":"alice","password":"s3cret"} -> 200 + token
 *   POST /auth/login {}                                       -> 401 AUTH_INVALID_CREDENTIALS
 *   GET  /auth/demo?username=alice&password=s3cret            -> 200（便于请求台手工取 token）
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { username?: string; password?: string }) {
    return this.authService.login(String(body?.username ?? ''), String(body?.password ?? ''));
  }

  @Get('demo')
  demo(@Query('username') username?: string, @Query('password') password?: string) {
    return {
      ...this.authService.login(String(username ?? ''), String(password ?? '')),
      note: '仅演示：真实项目登录必须 POST + TLS，token 放 Authorization: Bearer <token>',
    };
  }
}
