# 请求生命周期与中间件

请求生命周期实战：RequestIdMiddleware 给每个请求分配 requestId，RequestIdInterceptor 把它写进 X-Request-Id 响应头并统计耗时，全局异常过滤器让 400 错误响应也带上同一个 requestId。请求 /lifecycle 可看到完整组件顺序，/boom 可对比异常链路。

## 练习

在操练场加 X-Request-Id 中间件，再用拦截器写进响应头。

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
- `GET /echo/1`
- `GET /boom`
