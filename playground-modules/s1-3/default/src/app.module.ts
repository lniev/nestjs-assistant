import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatsModule } from './cats/cats.module';

/**
 * 练习 s1-3 · Provider 与依赖注入
 *
 * 这套默认代码把 s1-2 里塞在控制器内的内存数组抽成 CatsRepository：
 *   - 控制器只依赖接口（CatsRepository）与注入令牌（CATS_REPOSITORY）
 *   - 具体实现 InMemoryCatsRepository 通过 useClass 在 CatsModule 注册
 *
 * 建议动手：
 *   1. 在 cats.module.ts 里把 useClass 换成 useValue 返回固定数据，
 *      确认 controllers 一行都不用改。
 *   2. 再加一个 FancyCatsRepository 实现同一接口，对比两种 provider 写法。
 *   3. 打开 cats.module.ts 的 exports，故意删掉它，再在别处注入 CATS_REPOSITORY
 *      读「Nest can't resolve dependencies」报错。
 *
 * 真实项目里 CatsRepository 的实现会换成 TypeORM/Prisma，本练习用内存实现等价表达。
 */
@Module({
  imports: [CatsModule],
  controllers: [AppController],
})
export class AppModule {}
