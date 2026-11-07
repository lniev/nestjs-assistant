# 配置与环境治理

手写 @nestjs/config 等价物：ENV_SCHEMA 定义必填/默认/类型规则（URL、正整数、枚举、密钥最小长度），ConfigModule 在模块初始化阶段校验环境变量并注入全局 ConfigService，校验失败应用直接启动中止并逐条列出变量名。可改：删掉 PLAYGROUND_ENV_PRESET 的 DATABASE_URL 或把 JWT_SECRET 改短，点「运行」观察启动失败；POST /config/validate 可严格校验传入变量。

## 练习

在操练场删掉 .env 必填项，确认启动阶段就报错而非首请求崩溃。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /config`
- `GET /config/check`
- `POST /config/validate`
