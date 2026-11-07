# 守卫与访问控制

守卫与访问控制：自定义 @Roles 元数据 + RolesGuard（Reflector 读取）保护 DELETE /cats/:id，用 Authorization: Bearer admin-token / user-token 对比 401、403、200 三种结果。守卫先于管道执行，无权限请求不会进入参数校验与控制器。

## 练习

在操练场给 DELETE /cats/:id 加 RolesGuard，用三种身份对比 401/403。

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
- `DELETE /cats/1`
