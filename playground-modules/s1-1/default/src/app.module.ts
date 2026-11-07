import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

/**
 * 练习 s1-1 · 搭起可运行项目与启动链路
 *
 * 这一套默认代码是最小可运行骨架：
 *   - 一个根模块 AppModule
 *   - 一个 AppController，暴露 GET /health 与 GET /hello
 *   - bootstrap.ts 里的 configureApp() 是全局配置入口
 *
 * 建议动手：
 *   1. 在 bootstrap.ts 里打开 app.setGlobalPrefix('api')，再用请求台访问 /api/health
 *      观察 /health 变成 404 —— 这就是「全局前缀」的作用。
 *   2. 新增一个 GET /version 路由，返回 { version: '1.0.0' }。
 */
@Module({
  imports: [],
  controllers: [AppController],
})
export class AppModule {}
