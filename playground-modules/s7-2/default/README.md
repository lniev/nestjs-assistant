# 事件驱动与 CQRS

事件驱动 + CQRS 手写版：CommandBus 写订单、QueryBus 读事件投影，NotificationListener/PointsListener 通过 EventBus 订阅 order.created。POST /orders {failNotification:true} 可验证「通知失败不影响下单」，GET /events 查看监听器错误与失败隔离。

## 练习

在操练场把“下单发邮件”改成事件监听，对比接口耗时与失败影响。

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
- `GET /orders/1`
- `GET /events`
- `GET /notifications`
- `GET /points`
- `GET /commands`
