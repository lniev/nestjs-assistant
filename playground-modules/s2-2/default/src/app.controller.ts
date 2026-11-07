import { Controller, Get } from '@nestjs/common';

/** 健康检查是公开路由，不经过 RolesGuard。 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', module: 's2-2', time: new Date().toISOString() };
  }
}
