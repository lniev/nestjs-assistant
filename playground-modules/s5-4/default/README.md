# Web 安全边界与限流

安全基线三件套：手写 helmet 等价安全响应头、CORS 白名单（非白名单 Origin 直接 403）、登录滑动窗口限流（第 6 次 429 + Retry-After）。bootstrap.ts 里同时用 enableCors 回白名单头并去掉 X-Powered-By，/security/checklist 给出可继续补的安全自查清单。

## 练习

在操练场设置 CORS 白名单与登录限流，用请求台模拟跨域和刷登录。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /security/checklist`
- `GET /security/headers`
- `GET /security/cors-check?origin=https://portal.example.com`
- `GET /security/cors-check?origin=https://evil.example.com`
- `POST /auth/login`
- `GET /auth/rate-limit?username=alice`
