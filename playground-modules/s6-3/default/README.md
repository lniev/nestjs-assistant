# 结构化日志与可观测性

用实现 LoggerService 的 JSON Logger 替换 Nest 默认日志：每行含 ts/level/context/msg/traceId，中间件用 AsyncLocalStorage 串联同一请求的全部日志并回写 X-Trace-Id；password/token/authorization 等敏感字段自动脱敏；拦截器记录耗时、慢请求告警与 /metrics 计数，GET /logs?traceId= 可按 traceId 查回整条链路。

## 练习

在操练场把默认日志换成 JSON Logger，并注入 traceId 字段。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /logger/demo`
- `GET /logger/redact`
- `GET /logs`
- `GET /metrics`
