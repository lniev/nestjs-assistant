import { Controller, Get } from '@nestjs/common';
import { runCatsSpec } from './testing/cats.spec';

/**
 * 测试台入口：
 *   GET /test/run     执行 CatsService 单测套件，返回每条用例的结果
 *   GET /test/wiring  对照「真实 @nestjs/testing」与「操练场手写实现」的映射
 *
 * 真实项目里这些用例由 jest 执行（npm test），不会暴露成 HTTP 接口；
 * 这里开放出来是为了让你在请求台里直接看到「overrideProvider 后单测通过」。
 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      module: 's6-1',
      topic: '单元测试与测试模块',
      suite: '4 条用例：mock 仓储 / 404 / 400 / 正常创建',
      hint: 'GET /test/run 运行单测；GET /test/wiring 看与 @nestjs/testing 的对照',
    };
  }

  @Get('test/run')
  async run() {
    const report = await runCatsSpec();
    return {
      ok: report.failed === 0,
      total: report.results.length,
      passed: report.passed,
      failed: report.failed,
      results: report.results,
      note: '真实项目等价命令：npm test（jest + @nestjs/testing），本套件不访问数据库、5 秒内跑完',
    };
  }

  @Get('test/wiring')
  wiring() {
    return {
      real: {
        package: '@nestjs/testing + jest',
        create: 'Test.createTestingModule({ providers: [...] })',
        override: '.overrideProvider(CATS_REPOSITORY).useValue(fakeRepo)',
        compile: '.compile() 后 moduleRef.get(CatsService)',
        cleanup: 'afterEach(() => moduleRef.close())',
      },
      playground: {
        create: 'TestBed.createTestingModule({ providers: [...] })（src/testing/test-bed.ts）',
        override: '.overrideProvider(CATS_REPOSITORY).useValue(fakeRepo)',
        compile: '内部用 NestFactory.createApplicationContext 起一个不监听端口的容器',
        reason: '操练场未安装 @nestjs/testing / jest，用 Nest 自身 DI 复刻同样的 API 形状',
      },
      files: ['src/testing/test-bed.ts', 'src/testing/cats.spec.ts', 'src/cats/cats.service.ts'],
    };
  }
}
