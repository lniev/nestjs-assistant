import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CATS_REPOSITORY, InMemoryCatsRepository } from './cats.repository';

/**
 * 模块是 provider 的「注册边界」：
 *   providers 里注册的类/token 只在本模块可见；
 *   exports 出去的 provider 才能被其它模块注入（见 s1-4 的 LoggerModule）。
 *
 * 练习：把 useClass 换成 useValue（返回一份固定数据），
 *      或复制一个 InMemoryCatsRepository 改名成 MySqlCatsRepository，
 *      控制器始终不需要改动 —— 这就是依赖注入的价值。
 */
@Module({
  controllers: [CatsController],
  providers: [
    {
      provide: CATS_REPOSITORY,
      useClass: InMemoryCatsRepository,
    },
  ],
  exports: [CATS_REPOSITORY],
})
export class CatsModule {}
