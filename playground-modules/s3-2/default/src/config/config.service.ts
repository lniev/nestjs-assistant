import { Global, Injectable, Module } from '@nestjs/common';

// 操练场没有 @nestjs/config，也没有 @types/node；这里补一行最小声明。
// 真实项目：npm i @nestjs/config → ConfigModule.forRoot({ isGlobal: true })，
// 然后注入 @nestjs/config 的 ConfigService；下面的 AppConfigModule 是它的手写等价物。
declare const process: { env: Record<string, string | undefined> };

/**
 * 手写配置服务：读取环境变量并提供默认值。
 * 动态模块的 forRootAsync 在异步工厂里读取 bucket / region 等配置。
 */
@Injectable()
export class AppConfigService {
  get(key: string, fallback: string): string {
    const value = process.env[key];
    return value === undefined || value === '' ? fallback : value;
  }

  getNumber(key: string, fallback: number): number {
    const parsed = Number(this.get(key, String(fallback)));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}

/**
 * 手写版「全局配置模块」，等价于 ConfigModule.forRoot({ isGlobal: true })。
 * 做成 @Global() 后，任何模块的 forRootAsync 工厂都能直接注入 AppConfigService，
 * 不必每个 imports 里重复写。
 */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
