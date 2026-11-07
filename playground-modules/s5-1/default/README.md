# 认证：会话与令牌

手写认证链路：TokenService 用 node:crypto 的 HMAC-SHA256 签发 JWT 风格 access/refresh 令牌（含过期校验），UserRepository 存 scrypt 慢哈希密码，AuthService 实现注册/登录（失败 5 次锁 60s）/刷新轮换（旧 refresh 只能用一次，重放即吊销会话）/登出吊销，AuthGuard 做全局守卫并支持 @Public、@CurrentUser。可改：调整 TTL、换成 @nestjs/jwt+passport、把会话表换成 Redis 对比无状态 JWT 的取舍。

## 练习

在操练场走通登录、访问 /me、刷新令牌、旧 token 失效的链路。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /auth/demo`
- `GET /auth/me`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
