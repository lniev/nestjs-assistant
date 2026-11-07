# 缓存与读性能

手写 cache-manager 等价物：CacheService 提供带 TTL 的内存缓存与命中统计，CacheInterceptor 只缓存 GET（key 取 URL、TTL 由 @CacheTtl 覆盖），挂在慢查询商品列表/详情上，写接口更新后按前缀主动失效。可改：调整 TTL、给列表加分页参数观察 key 变化，或去掉 PATCH 里的失效逻辑对比一致性代价。

## 练习

在操练场给 GET /products/:id 加 CacheInterceptor，比较两次耗时。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /products`
- `GET /products/1`
- `PATCH /products/1`
- `GET /cache/stats`
