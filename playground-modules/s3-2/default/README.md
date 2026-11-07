# 动态模块与异步配置

手写 ConfigModule（全局配置服务）+ StorageModule.forRootAsync 动态模块：MediaModule 与 BackupModule 各自以不同 bucket/region 异步注册同一个存储模块，/media/files 与 /backup/files 的实例配置互不串。

## 练习

在操练场把硬编码 API key 改成 forRootAsync 读取 ConfigService。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /media/files`
- `GET /backup/files`
