import { Controller, Get, Query, Res } from '@nestjs/common';
import { SECURITY_CONFIG, assertOriginAllowed, isOriginAllowed } from './security/security';

/**
 * 安全自查入口：
 *   GET /security/checklist                      一页安全清单（deliverable）
 *   GET /security/cors-check?origin=<origin>     白名单判定：命中 200，未命中 403
 *   GET /security/headers                        当前响应实际带上的安全头
 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      module: 's5-4',
      topic: 'Web 安全边界与限流',
      corsAllowlist: SECURITY_CONFIG.corsAllowlist,
      loginLimit: SECURITY_CONFIG.login,
      hint: 'POST /auth/login 连点 6 次看 429；GET /security/cors-check?origin=https://evil.example.com 看 403',
    };
  }

  @Get('security/checklist')
  checklist() {
    return {
      title: 'Web 安全基线自查清单',
      items: [
        { item: '安全响应头', done: true, how: '手写 securityHeaders 中间件（生产用 helmet）' },
        { item: 'CORS 白名单', done: true, how: 'originGuard + enableCors，非白名单 403' },
        { item: '登录限流', done: true, how: 'LoginRateLimiter 滑动窗口（生产用 ThrottlerGuard）' },
        { item: 'CSRF 防护', done: false, how: 'Cookie 会话时加 SameSite=Strict + csurf 双提交 token' },
        { item: '输入校验', done: false, how: 'ValidationPipe + class-validator DTO（本练习未安装，见 s2-x）' },
        { item: '敏感信息脱敏', done: false, how: '日志与响应里过滤 password/token（见 s6-3）' },
        { item: 'HTTPS / HSTS', done: false, how: '反向代理终止 TLS，并下发 Strict-Transport-Security' },
      ],
      note: 'done=false 的条目是后续练习，照着 how 一列补即可。',
    };
  }

  /** 用 query 参数模拟 Origin，便于请求台验证白名单，无需真的跨域。 */
  @Get('security/cors-check')
  corsCheck(@Query('origin') origin?: string) {
    return {
      origin: origin ?? null,
      allowlist: SECURITY_CONFIG.corsAllowlist,
      decision: assertOriginAllowed(origin),
    };
  }

  /** 返回当前响应实际带上的安全响应头（中间件在 bootstrap 里全局挂载）。 */
  @Get('security/headers')
  headers(@Res({ passthrough: true }) response: any) {
    return {
      configured: SECURITY_CONFIG.headers,
      poweredByRemoved: typeof response.getHeader === 'function' ? !response.getHeader('X-Powered-By') : true,
      note: '真实项目用 helmet()，默认就覆盖这些头；HSTS 只在 HTTPS 下有意义',
    };
  }

  /** 便于在请求台直接看判定函数结果。 */
  @Get('security/origin')
  origin(@Query('origin') origin?: string) {
    return { origin: origin ?? null, allowed: isOriginAllowed(origin) };
  }
}
