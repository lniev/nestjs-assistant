# e2e 测试与回归套件

统一错误契约（statusCode + code + message + traceId + path + timestamp）配全局异常过滤器：登录失败 401 AUTH_INVALID_CREDENTIALS、无/坏 token 两种 401、越权 403 ORDER_FORBIDDEN、参数 400。GET /e2e/run 在进程内跑 6 条 e2e 场景（真实项目用 supertest），覆盖 401/403/400 边界和登录→下单→查询主链路。

## 练习

在操练场写一条登录失败 e2e，断言 401 与错误码字段。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /e2e/run`
- `GET /auth/demo?username=alice&password=s3cret`
- `POST /auth/login`
- `POST /orders`
- `GET /orders/1`
