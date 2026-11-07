import { Module } from '@nestjs/common';
import { LoggerModule } from '../shared/logger.module';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

/**
 * feature 模块：把猫咪资源的 controller / service 收拢在一起。
 *
 * 导入 LoggerModule 才能注入 LoggerService（跨模块依赖必须显式 imports）。
 * providers / controllers 都只在本模块内可见，不导出就不会泄漏到 AppModule。
 */
@Module({
  imports: [LoggerModule],
  controllers: [CatsController],
  providers: [CatsService],
  exports: [CatsService],
})
export class CatsModule {}
