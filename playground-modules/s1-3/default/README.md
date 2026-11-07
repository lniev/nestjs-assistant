# Provider 与依赖注入

依赖注入入门：控制器只依赖 CatsRepository 接口与 CATS_REPOSITORY 注入令牌，具体实现 InMemoryCatsRepository 由 CatsModule 用 useClass 注册。改 cats.module.ts 的 provider 即可换实现，控制器零改动。

## 练习

在操练场把内存实现换成 useClass 实现，观察 controller 是否需要改动。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /cats`
- `GET /cats/1`
- `POST /cats`
- `DELETE /cats/1`
