import { Controller, Get } from '@nestjs/common';

/** 健康检查：证明应用已启动。 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', module: 's1-3', time: new Date().toISOString() };
  }
}
