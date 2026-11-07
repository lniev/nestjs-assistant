import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { PLAYGROUND_ENV_PRESET, validateEnv } from './env-schema';

/**
 * 练习 s4-3 · 配置模块（@Global + 启动校验）
 *
 * 真实项目：
 *
 *   @Module({
 *     imports: [ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env.local', '.env'] })],
 *   })
 *   export class AppModule {}
 *
 * 关键点：validate 在**模块初始化阶段**执行。这里把校验放进 useFactory，
 * 一旦校验失败工厂抛错，Nest 启动直接中止并打印原因 —— 这就是「fail fast」。
 *
 * 练习：删掉 PLAYGROUND_ENV_PRESET 里的 DATABASE_URL 再点「运行」，
 *      日志里应出现「环境变量校验失败（应用启动中止）：- DATABASE_URL：缺少必填变量」。
 */
/** 操练场的 tsconfig 没有安装 @types/node，用 globalThis 取进程环境变量（等价于 process.env）。 */
function readProcessEnv(): Record<string, string | undefined> {
  const runtime = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return runtime.process?.env ?? {};
}

@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: () =>
        new ConfigService(
          validateEnv({
            // .env 预设值（可删，用来观察启动失败）；真实进程的环境变量优先级更高
            ...PLAYGROUND_ENV_PRESET,
            ...readProcessEnv(),
          }),
        ),
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
