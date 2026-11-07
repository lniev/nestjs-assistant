import { Body, Controller, Get, HttpException, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { LoginRateLimiter } from './rate-limit.service';

/** 内存用户表：真实项目查数据库 + bcrypt 校验密码。 */
const LOGIN_USERS = [
  { username: 'alice', password: 's3cret' },
  { username: 'bob', password: 'hunter2' },
];

/**
 * 登录接口 —— 限流 + 凭证校验的最小闭环。
 *
 * 手工验证限流：在请求台连续点 6 次 POST /auth/login（body {}），
 * 前 5 次返回 401 AUTH_INVALID_CREDENTIALS，第 6 次变成
 * 429 RATE_LIMITED + Retry-After 响应头。
 *
 * 真实项目：POST /auth/login 用 class-validator DTO + ValidationPipe 校验，
 * 密码用 bcrypt.compare，成功后签发 JWT（@nestjs/jwt）。
 */
@Controller('auth')
export class LoginController {
  constructor(private readonly limiter: LoginRateLimiter) {}

  @Post('login')
  login(
    @Body() body: { username?: string; password?: string },
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const key = String(request.ip ?? 'unknown') + ':' + (username || 'anonymous');

    const state = this.limiter.check(key);
    if (!state.allowed) {
      // 限流优先于凭证校验：被限流时不再泄露「用户名是否存在」。
      response.setHeader('Retry-After', String(state.retryAfterSec));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'RATE_LIMITED',
          message: '登录尝试过于频繁，请 ' + state.retryAfterSec + ' 秒后再试',
          retryAfterSec: state.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.limiter.record(key);

    const user = LOGIN_USERS.find((item) => item.username === username && item.password === password);
    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          code: 'AUTH_INVALID_CREDENTIALS',
          message: '用户名或密码错误',
          attemptsLeft: this.limiter.check(key).remaining,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 成功登录后清空计数；真实项目这里返回 accessToken + refreshToken。
    this.limiter.reset(key);
    return { ok: true, username: user.username, token: 'demo-token-' + user.username };
  }

  /** 观察窗口内剩余次数：连续刷新登录后看 remaining 递减。 */
  @Get('rate-limit')
  rateLimit(@Query('username') username?: string, @Query('client') client?: string) {
    const key = String(client ?? '127.0.0.1') + ':' + String(username ?? 'anonymous');
    return this.limiter.snapshot(key);
  }
}
