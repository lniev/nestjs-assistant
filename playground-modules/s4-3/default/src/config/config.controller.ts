import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from './config.service';
import { EnvValidationError, validateEnv } from './env-schema';

/**
 * 练习 s4-3 · 配置只读接口
 *
 *   GET  /config           查看启动校验后的配置（密钥打码）
 *   GET  /config/check     证明配置在启动阶段已校验通过
 *   POST /config/validate  严格模式校验 body 里的变量：传 {} 会返回 400 并逐条列出缺失项
 *
 * 注意：GET /config 是演示用的只读快照，真实项目不要暴露密钥字段（这里已打码）。
 */
@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  show() {
    return {
      source: '模块初始化阶段完成校验后的配置',
      ...this.config.publicSnapshot(),
      variables: this.config.describe(),
    };
  }

  @Get('check')
  check() {
    return {
      ok: true,
      nodeEnv: this.config.nodeEnv,
      isProduction: this.config.isProduction,
      message: '配置校验在启动阶段完成，应用已成功启动',
    };
  }

  /** 严格校验（不使用默认值）：模拟「部署时漏配变量」的诊断信息。 */
  @Post('validate')
  validate(@Body() body: Record<string, string>) {
    try {
      const values = validateEnv(body ?? {}, false);
      return { ok: true, variables: Object.keys(values), message: '校验通过' };
    } catch (error) {
      if (error instanceof EnvValidationError) {
        throw new BadRequestException({ message: error.message, issues: error.issues });
      }
      throw error;
    }
  }
}
