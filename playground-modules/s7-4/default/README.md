# 微服务拆分与消息一致性

单进程版「订单服务 + 通知服务」：订单与 outbox 同事务写入，提交后用内存消息代理 emit order.created，通知服务按 messageId 幂等消费、失败进死信；/orders/:id/notification-preview 演示 send 请求-响应。/orders/rollback-demo 验证回滚时消息不发出。

## 练习

在操练场启动两个服务，用 ClientProxy.send 与 emit 对比两种模式。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /orders`
- `POST /orders`
- `GET /outbox`
- `GET /notifications`
- `GET /dead-letters`
- `GET /orders/1/notification-preview`
- `POST /orders/rollback-demo`
- `POST /notifications/fail`
