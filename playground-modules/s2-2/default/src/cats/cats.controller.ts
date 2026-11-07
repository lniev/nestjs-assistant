import { Controller, Delete, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { Cat, CatsService } from './cats.service';

/**
 * 控制器级 @UseGuards(RolesGuard)：本控制器所有路由都过守卫。
 *
 * 守卫内部再按 @Roles 元数据区分：
 *   - GET /cats、GET /cats/:id  没有 @Roles → 公开
 *   - DELETE /cats/:id          有 @Roles('admin') → 只有 admin 能删
 */
@Controller('cats')
@UseGuards(RolesGuard)
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Get()
  findAll(): Cat[] {
    return this.catsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Cat {
    return this.catsService.findOne(id);
  }

  /** 破坏性操作：需要 admin 角色；无 token → 401，角色不足 → 403。 */
  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number): Cat {
    return this.catsService.remove(id);
  }
}
