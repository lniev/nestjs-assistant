import { Controller, Get } from '@nestjs/common';

/** 最小控制器：验证启动链路与请求台是否连通。 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', module: 's1-1', time: new Date().toISOString() };
  }

  @Get('hello')
  hello() {
    return { message: 'Hello NestJS', hint: '改这里然后点「运行」' };
  }
}
