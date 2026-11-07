import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { CatsController } from './cats/cats.controller';
import { CatsService } from './cats/cats.service';
import { ValidationPipe } from './common/validation.pipe';

/**
 * 练习 s2-1 · 管道与 DTO 校验
 *
 * 全局管道用 APP_PIPE 注册（等价于 bootstrap 里 app.useGlobalPipes）：
 *   { provide: APP_PIPE, useClass: ValidationPipe }
 *
 * 管道在守卫之后、handler 之前执行，职责是「转换 + 校验」：
 *   - @Body() 的 CreateCatDto 由全局 ValidationPipe 校验并剥离多余字段
 *   - @Param('id') 用内置 ParseIntPipe 做参数级转换
 *   - @Query() 的 ListCatsQuery 也会走全局管道（管道对每种参数都生效）
 *
 * 建议动手：
 *   1. 请求 POST /cats 传 {}，观察 400 与具体错误列表。
 *   2. 传 { "name": "Tom", "age": 3, "extra": 1 }，观察 extra 被白名单剥离。
 *   3. 在 validation.pipe.ts 里打开 forbidNonWhitelisted 语义（遇到未知字段直接 400）。
 *
 * 注意：本插件未安装 class-validator / class-transformer，
 * 所以 dto.ts 与 validation.pipe.ts 用手写实现等价表达，注释里写了真实项目的写法。
 */
@Module({
  controllers: [AppController, CatsController],
  providers: [
    CatsService,
    { provide: APP_PIPE, useClass: ValidationPipe },
  ],
})
export class AppModule {}
