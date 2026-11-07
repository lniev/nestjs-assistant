# 单元测试与测试模块

把 @nestjs/testing 的 createTestingModule / overrideProvider / compile / get 用 NestFactory.createApplicationContext 手写等价实现；CatsService 依赖 CATS_REPOSITORY 令牌，单测用 fake 仓储替换真实仓储并断言 404/400。GET /test/run 执行 4 条用例，默认服务照常可运行（/cats 增删查）。

## 练习

在操练场为 CatsService 写单测，用 overrideProvider 替换 Repository。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /test/run`
- `GET /test/wiring`
- `GET /cats`
- `GET /cats/1`
- `POST /cats`
