# 超时、重试、熔断与幂等

手写的超时/指数退避重试/熔断器包住一个假慢下游：GET /shipping/quote/:id 永远有兜底报价，POST /shipping/downstream 把延迟调到 300ms 可观察超时、重试与熔断打开（/shipping/circuit）；POST /payments 用 Idempotency-Key 演示重复请求只扣一次款。

## 练习

在操练场模拟下游 3 秒延迟，验证超时、熔断打开与降级返回值。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /shipping/quote/1`
- `GET /shipping/circuit`
- `POST /shipping/downstream`
- `POST /shipping/reset`
- `POST /payments`
- `GET /payments`
