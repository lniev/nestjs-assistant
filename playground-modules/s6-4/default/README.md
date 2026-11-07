# 文档、版本化与上线

手写 Swagger 等价物：@ApiProperty 元数据 + OpenAPI 文档（GET /docs/openapi.json、GET /docs）；URI/Header 两种版本化；liveness/readiness 探针与部署清单。可改 DTO 装饰器观察 schema 同步，或切换假依赖看 readiness 变 503。

## 练习

在操练场生成 Swagger 文档，给 DTO 加 @ApiProperty 后检查 schema。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /health/ready`
- `GET /docs/openapi.json`
- `GET /v1/orders`
- `GET /v2/orders`
- `GET /orders`
- `POST /v1/orders`
