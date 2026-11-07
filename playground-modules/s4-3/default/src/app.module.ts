import { Controller, Get, Module } from '@nestjs/common';
import { ConfigController } from './config/config.controller';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';

/**
 * 练习 s4-3 · 配置与环境治理
 *
 * 分层：
 *   ENV_SCHEMA（env-schema.ts）   = 配置契约 + 校验规则（真实项目用 Joi/zod schema）
 *   ConfigService                 = 只读访问器（get / getOrThrow / 命名空间）
 *   ConfigModule                  = 启动时校验并注入全局 ConfigService
 *
 * 可改：
 *   1. 删掉 PLAYGROUND_ENV_PRESET 里的 DATABASE_URL → 启动失败，观察错误文案；
 *   2. 把 JWT_SECRET 改短（< 16 字符）→ 启动失败，提示长度不足；
 *   3. 把 NODE_ENV 改为 production 以外的非法值（如 staging）→ 枚举校验失败。
 */
@Controller()
export class AppController {
  constructor(private readonly config: ConfigService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's4-3', nodeEnv: this.config.nodeEnv };
  }
}

@Module({
  imports: [ConfigModule],
  controllers: [AppController, ConfigController],
})
export class AppModule {}
