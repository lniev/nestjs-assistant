# 控制器与 REST 路由

控制器入门：CatsController 用 @Controller('cats') + @Get/@Post/@Patch/@Delete 实现 5 个内存数组版 CRUD 路由，演示 @Param、@Query、@Body 取值与 @HttpCode 状态码控制。改这里可以练习路由声明顺序、参数校验与状态码。

## 练习

在操练场分别用 @Param 版与 @Query 版实现 GET /cats/:id，对比参数绑定差异。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /routes`
- `GET /cats`
- `GET /cats/search?name=Tom`
- `GET /cats/1`
- `PATCH /cats/1`
- `POST /cats`
- `DELETE /cats/1`
