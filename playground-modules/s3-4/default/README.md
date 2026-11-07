# 循环依赖与生命周期

这套默认代码把 A/B 两个服务做成「A→B→A」的循环依赖：模块层用 forwardRef 打破 import 环，AService 构造注入 forwardRef(BService)，BService 改用 ModuleRef 延迟解析 AService；两个服务还带 OnModuleInit 预热与 OnApplicationShutdown 优雅关闭日志。可改：删掉任一 forwardRef 观察启动报错，或把 ModuleRef 换成两侧构造注入对比两种解法。

## 练习

在操练场构造 A 与 B 循环依赖，分别用 forwardRef 与 ModuleRef 解决。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /lifecycle`
- `GET /a/ping`
- `GET /b/ping`
- `GET /a/lazy`
