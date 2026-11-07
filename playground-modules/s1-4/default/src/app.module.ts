import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatsModule } from './cats/cats.module';
import { LoggerModule } from './shared/logger.module';

/**
 * 练习 s1-4 · 模块边界与共享模块
 *
 * 根模块只负责「组装」：
 *   - CatsModule：feature 模块，自带 controller 与 service，内部导入 LoggerModule
 *   - LoggerModule：shared 模块，注册并 exports LoggerService，谁 import 谁就能注入
 *   - AppController：直接注入 LoggerService，验证 exports 的可见性
 *
 * 建议动手：
 *   1. 删掉 shared/logger.module.ts 里的 exports: [LoggerService]，
 *      重新运行 —— App 启动时报「Nest can't resolve dependencies」，这就是模块边界。
 *   2. 把 LoggerModule 加上 @Global()，从 CatsModule 的 imports 里删掉它，观察依然能注入。
 *   3. 新增一个 HealthModule，把 AppController 挪过去，体会 feature 模块的组织方式。
 *
 * 注意：AppModule 只导入两个模块就能启动，不把 provider 全部堆在根模块。
 */
@Module({
  imports: [CatsModule, LoggerModule],
  controllers: [AppController],
})
export class AppModule {}
