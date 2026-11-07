import { Body, Controller, Get, HttpStatus, Post, Res } from '@nestjs/common';

/**
 * 健康检查（等价 @nestjs/terminus 的核心用法）。
 *
 * 真实项目：
 *   - @nestjs/terminus 提供 HealthCheckService、@HealthCheck()、
 *     TypeOrmHealthIndicator / HttpHealthIndicator / MemoryHealthIndicator；
 *   - k8s 里 liveness 与 readiness 是两个不同用途的探针：
 *       liveness 失败 → 重启容器；readiness 失败 → 从 Service 摘流量。
 *
 * 这里用一个「假依赖」开关模拟数据库，演示两种探针的差别。
 */
@Controller('health')
export class HealthController {
  private static readonly startedAt = Date.now();

  /** 模拟数据库连接状态；POST /health/dependency { "up": false } 可切换。 */
  private dependencyUp = true;

  /** liveness：只要进程能响应就返回 200，不查任何依赖。 */
  @Get()
  liveness() {
    return {
      status: 'ok',
      module: 's6-4',
      check: 'liveness',
      uptimeSeconds: Math.round((Date.now() - HealthController.startedAt) / 1000),
      at: new Date().toISOString(),
    };
  }

  /** readiness：依赖不可用时返回 503，让网关把流量摘走（但不要重启容器）。 */
  @Get('ready')
  readiness(@Res({ passthrough: true }) res: any) {
    const snapshot = this.readinessSnapshot();
    res.status(this.dependencyUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return snapshot;
  }

  /** 故障演练：切换假依赖（数据库）的可用性，观察 /health/ready 的状态码。 */
  @Post('dependency')
  toggleDependency(@Body() body: { up?: boolean }) {
    this.dependencyUp = body?.up !== false;
    return { ok: true, dependencyUp: this.dependencyUp, readiness: this.readinessSnapshot() };
  }

  private readinessSnapshot() {
    const checks = {
      database: this.dependencyUp ? 'up' : 'down',
      cache: 'up',
    };
    return {
      status: this.dependencyUp ? 'ok' : 'error',
      module: 's6-4',
      check: 'readiness',
      checks,
      at: new Date().toISOString(),
    };
  }
}
