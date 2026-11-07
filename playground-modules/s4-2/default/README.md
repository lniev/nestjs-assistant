# 事务、关联与查询性能

用内存库模拟带事务与查询日志的数据库：下单把「查库存→扣库存→写订单」放进同一事务（互斥排队 + 失败快照回滚），并发压力演示保证库存不为负；列表用一条 JOIN + COUNT 固定 2 条 SQL，另有 N+1 反例路由对比 2+2N 条（COUNT + 列表 + 每行 2 条）。可改：把扣库存挪到事务外再用 POST /orders/stress 复现超卖，或给分页加过滤条件。

## 练习

在操练场打开查询日志，对比修复前后列表请求的 SQL 条数。

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
- `GET /orders/1`
- `GET /orders/n-plus-one`
- `POST /orders`
- `GET /db/stats`
