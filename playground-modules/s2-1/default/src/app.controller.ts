import { Controller, Get } from '@nestjs/common';

/** 健康检查：不经过 DTO 校验，用来确认应用已启动。 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', module: 's2-1', time: new Date().toISOString() };
  }
}
