import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatsController } from './cats/cats.controller';
import { CATS_REPOSITORY, CatsService, InMemoryCatsRepository } from './cats/cats.service';

/**
 * 练习 s6-1 · 单元测试与测试模块
 *
 * 结构：
 *   cats/cats.service.ts      CatsService + 仓储端口 + Symbol 注入令牌 + 内存实现
 *   cats/cats.controller.ts   正常业务路由（服务本身可运行）
 *   testing/test-bed.ts       手写 TestingModule（createTestingModule/overrideProvider/compile）
 *   testing/cats.spec.ts      4 条单测（mock 仓储、404、400、正常创建）
 *   app.controller.ts         /test/run 执行套件、/test/wiring 对照真实 @nestjs/testing
 *
 * 建议动手：
 *   1. GET /test/run 看 4 条用例全绿；
 *   2. 把 CatsService.create 里的 name 校验删掉，再访问 /test/run —— 第三条用例应该变红；
 *   3. 在 cats.spec.ts 里加一条「age 为负数抛 400」的用例。
 *
 * 真实项目：npm test 会跑同样的断言（jest + @nestjs/testing），
 * CI 里用 --coverage 出覆盖率报告，service 层单测不连数据库。
 */
@Module({
  controllers: [AppController, CatsController],
  providers: [CatsService, { provide: CATS_REPOSITORY, useClass: InMemoryCatsRepository }],
})
export class AppModule {}
