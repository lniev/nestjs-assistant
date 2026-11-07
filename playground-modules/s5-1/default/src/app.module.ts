import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth/auth.controller';
import { AuthGuard, Public } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { TokenService } from './auth/security';
import { UserRepository } from './auth/user.repository';

/**
 * 练习 s5-1 · 认证：会话与令牌
 *
 * 分层：
 *   TokenService   手写 JWT 风格令牌（HMAC-SHA256）：签发 / 校验 / 过期
 *   UserRepository 用户表（内存）+ 密码哈希（scrypt，绝不存明文）
 *   AuthService    注册/登录/刷新轮换/登出吊销 + 登录失败限流
 *   AuthGuard      全局守卫，@Public() 放行公开路由，@CurrentUser() 取当前用户
 *
 * 真实项目接线（对照）：
 *   JwtModule.registerAsync({ ... })、PassportModule、LocalStrategy/JwtStrategy、
 *   @UseGuards(AuthGuard) 或 APP_GUARD，以及 Redis 存 refreshToken 会话。
 */
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', module: 's5-1' };
  }
}

@Module({
  controllers: [AppController, AuthController],
  providers: [
    // 全局守卫：默认所有路由都要登录，公开路由用 @Public() 显式放行
    { provide: APP_GUARD, useClass: AuthGuard },
    TokenService,
    UserRepository,
    AuthService,
  ],
})
export class AppModule {}
