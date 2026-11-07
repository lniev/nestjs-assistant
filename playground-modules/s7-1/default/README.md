# 队列、异步任务与调度

内存版 BullMQ：POST /queue/report 入队即返回 202，消费者异步执行报表；任务带 attempts/maxAttempts/指数 backoff，失败先 delayed 再重试、超限进 failed；/queue/tick 手动消费便于观察；/schedule/reconcile 用内存锁演示定时对账单实例执行。

## 练习

在操练场创建 report 队列，注入失败任务，观察 attempts 与 backoff。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `POST /queue/report`
- `GET /queue/jobs`
- `GET /queue/jobs/1`
- `POST /queue/tick`
- `GET /queue/stats`
- `GET /schedule/status`
- `POST /schedule/reconcile`
