import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth/auth';
import { runRegression } from './e2e/regression';
import { OrdersService } from './orders/orders';

/**
 * e2e 入口：
 *   GET /health   健康检查（不带鉴权）
 *   GET /e2e/run  执行 6 条回归场景并返回结果
 *
 * 真实项目里 CI 命令是 `npm run test:e2e`（jest + supertest），
 * 这里把同一套断言开放成 HTTP 接口，方便在请求台里反复点。
 */
@Controller()
export class AppController {
  constructor(
    private readonly authService: AuthService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      module: 's6-2',
      topic: 'e2e 测试与回归套件',
      errorContract: ['statusCode', 'code', 'message', 'traceId', 'path', 'timestamp'],
      hint: 'GET /e2e/run 运行回归套件；POST /auth/login {} 看 401 错误契约',
    };
  }

  @Get('e2e/run')
  run() {
    const report = runRegression(this.authService, this.ordersService);
    return {
      ok: report.failed === 0,
      total: report.results.length,
      passed: report.passed,
      failed: report.failed,
      results: report.results,
      note: '真实项目等价命令：npm run test:e2e（supertest + createNestApplication）；故意改坏校验时这里会变红',
    };
  }
}
