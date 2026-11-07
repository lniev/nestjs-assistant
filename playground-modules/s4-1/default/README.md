# ORM 接入与数据建模

这套默认代码演示 ORM 分层：实体（User/Order + 列元数据）→ 内存 DataSource（模拟迁移与种子）→ Repository 接口/实现 → Service → Controller，接口与持久化细节隔离，把内存仓储换成 TypeORM 仓储时 Service 方法签名不变。可改：给列表加分页、把 AppModule 里的 useFactory 换成 useClass，或删掉必填字段看 400/409 处理。

## 练习

在操练场把内存仓储换成 ORM 仓储，保持 service 方法签名不变。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /users`
- `GET /users/1`
- `GET /users/1/orders`
- `GET /orders`
- `POST /users`
