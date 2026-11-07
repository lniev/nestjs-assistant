# 异常过滤器与错误契约

全局 @Catch() 异常过滤器 + 业务错误码表：把 404、业务校验 400 与未知异常 500 统一成 { success, code, message, traceId }，未知异常只在服务端日志保留堆栈；含 /missing-order、/boom 与 POST /orders 三条对照路由。

## 练习

在操练场故意抛 new Error，对比默认 500 与自定义过滤器的输出。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /orders/:id`
- `GET /missing-order`
- `POST /orders`
- `GET /boom`
