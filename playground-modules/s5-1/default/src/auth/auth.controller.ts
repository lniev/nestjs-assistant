import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthenticatedRequest, CurrentUser, Public } from './auth.guard';
import { AuthService } from './auth.service';
import { PublicUser } from './user.repository';

/**
 * 练习 s5-1 · 认证接口
 *
 *   POST /auth/register  { email, password, name? }  → 注册并直接发令牌
 *   POST /auth/login     { email, password }         → 登录（连续失败 5 次锁 60s）
 *   POST /auth/refresh   { refreshToken }            → 换新令牌（旧 refresh 立即作废）
 *   POST /auth/logout    需要 Bearer                  → 吊销当前会话
 *   GET  /auth/me        需要 Bearer                  → 当前用户
 *   GET  /auth/demo      公开                         → 给演示账号 alice 发一对令牌（仅操练场便利）
 *
 * 完整链路（在请求台里按顺序做）：
 *   1. GET /auth/demo 复制 accessToken / refreshToken；
 *   2. GET /auth/me，Header 加 Authorization: Bearer <accessToken>（或用 ?access_token=）；
 *   3. POST /auth/refresh 带 refreshToken → 得到新的一对；
 *   4. 再用旧的 refreshToken 调一次 → 401「刷新令牌已使用过」；
 *   5. POST /auth/logout，然后拿同一 accessToken 调 /auth/me → 401（会话已吊销）。
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: { email?: string; password?: string; name?: string }) {
    return this.authService.register(body ?? {});
  }

  @Public()
  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body ?? {});
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: { refreshToken?: string }) {
    return this.authService.refresh(body?.refreshToken);
  }

  @Public()
  @Get('demo')
  demo() {
    return this.authService.demoLogin();
  }

  /** 受保护：没有有效 accessToken 返回 401。 */
  @Get('me')
  me(@CurrentUser() user: PublicUser) {
    return { user, hint: '这行能返回，说明守卫校验了 Bearer 令牌与服务端会话' };
  }

  /** 受保护：登出后整个会话被吊销，旧 accessToken 立即失效。 */
  @Post('logout')
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(String(request.sessionId));
  }
}
