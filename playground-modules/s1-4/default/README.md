# 模块边界与共享模块

模块边界入门：根模块只组装 CatsModule（feature）与 LoggerModule（shared），LoggerModule 通过 exports 共享 LoggerService，CatsService 与 AppController 都注入它。删掉 exports 或 imports 就能直观看到「Nest can't resolve dependencies」。

## 练习

在操练场拆出 CatsModule，故意注入未导出的 service，读报错再修复。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /logs`
- `GET /cats`
- `GET /cats/1`
- `POST /cats`
