# 自定义装饰器与执行上下文

认证中间件 + @CurrentUser()/@RequestId() 两个 createParamDecorator 示例：控制器直接拿到用户对象、单个字段与请求 ID，不再注入 @Req()；/context 还演示 ExecutionContext.getHandler()/getClass() 的用法。

## 练习

在操练场用 @CurrentUser() 替代 @Req()，并支持只取某个字段。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /me`
- `GET /me/role`
- `GET /context`
