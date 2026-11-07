# 授权：策略与 RBAC

订单资源的 owner/staff/admin 三级 RBAC：AuthenticatedGuard 负责 401，RolesGuard + @Roles() 管路由级 403，OrderPolicy 管记录级 403（订单不存在才 404）。GET /orders/policy-spec 直接执行策略单测。用 ?as=1/2/9/10 模拟不同身份。

## 练习

在操练场用两个用户互访订单，验证返回 403 而非带信息的 404。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /orders/policy-spec`
- `GET /orders?as=1`
- `GET /orders/1?as=1`
- `GET /orders/2?as=1`
- `GET /orders/2`
- `GET /admin/orders?as=2`
- `GET /admin/orders?as=9`
