# 管道与 DTO 校验

管道与 DTO 校验：CreateCatDto/ListCatsQuery 手写等价于 class-validator 的校验与白名单，ValidationPipe 用 APP_PIPE 全局注册，@Param('id') 再叠加内置 ParseIntPipe。请求 POST /cats 传 {} 可看到 400 与错误列表，handler 根本不会执行。

## 练习

在操练场提交缺少 name 的请求，对比 whitelist 开关时的响应。

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
- `GET /cats?name=Tom&limit=1`
- `GET /cats/1`
- `POST /cats`
