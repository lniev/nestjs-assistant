import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './config/config.service';

/** 健康检查：顺便回显当前配置环境，方便确认「切换环境即换实现」。 */
@Controller()
export class AppController {
  constructor(private readonly config: AppConfigService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      module: 's3-1',
      environment: this.config.environment,
    };
  }
}
