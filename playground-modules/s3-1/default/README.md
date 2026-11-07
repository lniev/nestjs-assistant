# 自定义 Provider 与注入令牌

四类自定义 provider 全覆盖：useValue 注入应用元信息、useClass 按 NODE_ENV 在沙箱/生产支付实现间切换、useFactory 注入配置后创建带超时的 HTTP 客户端、useExisting 起别名；令牌含抽象类、Symbol 与字符串三种。

## 练习

在操练场用 useFactory 注入 ConfigService，返回带超时的 HTTP 客户端。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /payments/config`
- `POST /payments/charge`
