import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatsController } from './cats/cats.controller';

/**
 * 练习 s1-2 · 控制器与 REST 路由
 *
 * 默认代码包含两个控制器：
 *   - AppController：/health 与 /routes（路由表速览）
 *   - CatsController：@Controller('cats') 下的内存数组版 CRUD
 *
 * 建议动手：
 *   1. 把 @Get('search') 挪到 @Get(':id') 后面，重新运行后请求 /cats/search，
 *      观察它被 :id 路由抢走（Nest 按声明顺序注册路由）。
 *   2. 给 DELETE 换成 @HttpCode(HttpStatus.NO_CONTENT)，对比响应体差异。
 *   3. 把内存数组改成 Map，练习 @Body 的增量更新。
 *
 * 注意：本练习刻意不抽 Service —— 那是 s1-3「Provider 与依赖注入」的内容。
 */
@Module({
  controllers: [AppController, CatsController],
})
export class AppModule {}
