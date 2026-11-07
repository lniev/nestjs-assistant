import { ForbiddenException } from '@nestjs/common';

/**
 * 练习 s5-4 · Web 安全边界与限流
 *
 * 这一层是「安全基线」的配置与手写中间件：
 *   - CORS 白名单：只允许自家前端域名；带 Origin 的非白名单请求直接 403。
 *   - 安全响应头：等价于 helmet（生产环境直接 app.use(helmet())）。
 *   - 登录限流：见 auth/rate-limit.service.ts（等价于 @nestjs/throttler 的 ThrottlerGuard）。
 *
 * 真实项目：
 *   app.use(helmet());
 *   app.enableCors({ origin: ['https://portal.example.com'], credentials: true });
 *   限流用 ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]) + ThrottlerGuard；
 *   Cookie 会话再加 csurf / SameSite=Strict 做 CSRF 防护。
 */

export const SECURITY_CONFIG = {
  /** 只有这些 Origin 允许跨域携带 Cookie 调用接口。 */
  corsAllowlist: ['https://portal.example.com', 'https://admin.example.com'],
  /** 登录限流：60 秒内同一 (IP + 用户名) 最多 5 次，第 6 次 429。 */
  login: { maxAttempts: 5, windowMs: 60 * 1000 },
  /** helmet 的核心响应头（演示用，真实项目直接 app.use(helmet())）。 */
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-DNS-Prefetch-Control': 'off',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
  } as Record<string, string>,
};

export function isOriginAllowed(origin: string | undefined | null): boolean {
  if (!origin) return true; // 同源 / 服务端调用没有 Origin 头
  return SECURITY_CONFIG.corsAllowlist.indexOf(origin) >= 0;
}

/**
 * Origin 白名单中间件。浏览器跨域时一定带 Origin，只要不在白名单就 403。
 * 注意：CORS 是浏览器的同源策略，服务端仍然要自己校验，不能只依赖 enableCors。
 */
export function originGuard(request: any, response: any, next: () => void): void {
  const origin = request.headers?.origin;
  if (typeof origin === 'string' && origin !== '' && !isOriginAllowed(origin)) {
    response.status(403).json({
      statusCode: 403,
      code: 'CORS_ORIGIN_DENIED',
      message: 'Origin 不在白名单：' + origin,
      allowlist: SECURITY_CONFIG.corsAllowlist,
    });
    return;
  }
  next();
}

/** 安全响应头中间件（helmet 等价物），并去掉暴露技术栈的 X-Powered-By。 */
export function securityHeaders(_request: any, response: any, next: () => void): void {
  if (typeof response.removeHeader === 'function') response.removeHeader('X-Powered-By');
  for (const [name, value] of Object.entries(SECURITY_CONFIG.headers)) {
    response.setHeader(name, value);
  }
  next();
}

/** /security/cors-check 用的判定：不满足就抛 403（方便在请求台直接看到被拒）。 */
export function assertOriginAllowed(origin: string | undefined): { allowed: true; origin: string | null } {
  if (!isOriginAllowed(origin)) {
    throw new ForbiddenException({
      code: 'CORS_ORIGIN_DENIED',
      message: 'Origin 不在白名单：' + origin,
      allowlist: SECURITY_CONFIG.corsAllowlist,
    });
  }
  return { allowed: true, origin: origin ?? null };
}
