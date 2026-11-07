# 搭起可运行项目与启动链路

最小可运行骨架：AppModule + AppController（GET /health、GET /hello）+ bootstrap.ts 全局配置钩子。适合练习全局前缀、端口与启动链路。

## 练习

在操练场改 main.ts 的端口与全局前缀，再用请求台验证 /api/health。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /hello`
