# 拦截器与统一响应

用两个全局拦截器演示统一响应与耗时日志：TransformInterceptor 把返回值包成 { code, data, traceId, durationMs }，LoggingInterceptor 记录方法/路径/毫秒并在慢请求与异常时告警；含 /slow 与 /boom 两条对照路由。

## 练习

在操练场写 TransformInterceptor，把返回值包进 data 并补上耗时。

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
- `GET /slow`
- `GET /boom`
