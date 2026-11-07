import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

/**
 * CatsModule 同时注册守卫与业务服务。
 *
 * 守卫可以挂在控制器上（@UseGuards(RolesGuard)），也可以全局注册：
 *   { provide: APP_GUARD, useClass: RolesGuard }
 * 全局注册时记得给公开路由加 @Public() 元数据，否则所有接口都会被要求登录。
 */
@Module({
  controllers: [CatsController],
  providers: [CatsService, RolesGuard],
})
export class CatsModule {}
