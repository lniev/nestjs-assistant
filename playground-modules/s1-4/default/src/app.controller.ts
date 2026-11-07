import { Controller, Get } from '@nestjs/common';
import { LoggerService } from './shared/logger.module';

/**
 * 这个控制器能注入 LoggerService，是因为 AppModule import 了 LoggerModule，
 * 而 LoggerModule 把 LoggerService 放进了 exports —— 这就是「共享模块」的可见性规则。
 */
@Controller()
export class AppController {
  constructor(private readonly logger: LoggerService) {}

  @Get('health')
  health() {
    this.logger.log('GET /health 健康检查');
    return { status: 'ok', module: 's1-4', time: new Date().toISOString() };
  }

  @Get('logs')
  logs() {
    return { recent: this.logger.recent() };
  }
}
