import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LoginController } from './auth/login.controller';
import { LoginRateLimiter } from './auth/rate-limit.service';

/**
 * 练习 s5-4 · Web 安全边界与限流
 *
 * 结构：
 *   security/security.ts       CORS 白名单、安全响应头中间件与自查清单配置
 *   auth/rate-limit.service.ts 登录限流（滑动窗口，等价 ThrottlerGuard）
 *   auth/login.controller.ts   POST /auth/login（第 6 次 429）+ 限流观察接口
 *   app.controller.ts          /security/* 自查与 CORS 判定入口
 *   bootstrap.ts               enableCors(白名单) + 全局挂载安全中间件
 *
 * 建议动手：
 *   1. 请求台连点 6 次 POST /auth/login，观察 401 → 429 与 Retry-After；
 *   2. 把 maxAttempts 改成 2，观察变更立刻生效；
 *   3. 在 bootstrap 里把 enableCors 的 origin 改成 '*'，对比 credentials 的限制。
 */
@Module({
  controllers: [AppController, LoginController],
  providers: [LoginRateLimiter],
})
export class AppModule {}
