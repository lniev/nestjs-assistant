# 作用域与请求上下文

AsyncLocalStorage 请求上下文：中间件用 als.run 包裹整条请求链，单例 AuditService 在深处直接读 traceId/userId 零传参；同一套代码还放了 REQUEST 作用域对比组，/audit/stats 可看到单例实例恒为 1、请求级实例每请求 +1。

## 练习

在操练场用 ALS 存 traceId，在 service 深处读取而不传参。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /audit/whoami`
- `GET /audit/stats`
