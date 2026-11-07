import { Injectable } from '@nestjs/common';

// 操练场没有安装 @types/node，也没有 @nestjs/config；这里补一行最小声明。
// 真实项目：npm i @nestjs/config，AppModule imports: [ConfigModule.forRoot({ isGlobal: true })]，
// 然后直接注入 @nestjs/config 的 ConfigService（get/getOrThrow），不必自己实现。
declare const process: { env: Record<string, string | undefined> };

/** 当前运行环境（操练场 runner 会把子进程 NODE_ENV 固定成 development）。 */
export const NODE_ENV: string = process.env.NODE_ENV ?? 'sandbox';

/**
 * 支付实现的选择开关：
 *   - 真实部署：设置 NODE_ENV=production 就会自动切到生产实现；
 *   - 操练场：runner 固定把子进程 NODE_ENV 设为 development、也不透传自定义环境变量，
 *     想在这里演示「切环境换实现」，把下面三目表达式里的 'sandbox' 改成 'production'
 *     再点「运行」，然后访问 /payments/config 观察 provider 变化。
 */
export const PAYMENT_MODE: string =
  process.env.PAYMENT_MODE ??
  (NODE_ENV === 'production' ? 'production' : 'sandbox');

/**
 * 手写版配置服务：模拟 @nestjs/config 的 ConfigService。
 * 真实项目里 get/getNumber 由 @nestjs/config 提供，还支持 .env 文件与 schema 校验；
 * 这里用 process.env + 默认值表达同样的「配置集中在一处、业务不直接读环境变量」。
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

  get environment(): string {
    return this.get('NODE_ENV', 'sandbox');
  }

  get isProduction(): boolean {
    return this.environment === 'production';
  }
}
