import { Injectable } from '@nestjs/common';
import { ENV_SCHEMA, EnvVarSpec, maskValue } from './env-schema';

/**
 * 练习 s4-3 · 手写版本 ConfigService
 *
 * 真实项目直接注入 @nestjs/config 的 ConfigService，并配合 registerAs 命名空间：
 *
 *   export default registerAs('database', () => ({
 *     url: process.env.DATABASE_URL,
 *     poolSize: Number(process.env.DB_POOL_SIZE ?? 10),
 *   }));
 *
 *   constructor(private readonly config: ConfigService) {}
 *   const url = this.config.getOrThrow<string>('database.url');
 *
 * 这里的实现对外暴露同样的 get / getOrThrow，方便你把代码迁移到 @nestjs/config。
 */

export interface ConfigEntryView {
  name: string;
  description: string;
  required: boolean;
  secret: boolean;
  value: string;
}

@Injectable()
export class ConfigService {
  private readonly values: Record<string, string>;
  private readonly schema: EnvVarSpec[] = ENV_SCHEMA;

  constructor(values: Record<string, string>) {
    // 注意：构造函数只接收「已校验通过」的值，校验失败会在工厂里直接抛错。
    this.values = { ...values };
  }

  get(name: string): string | undefined {
    return this.values[name];
  }

  /** 取必填配置：缺失直接抛错，避免到处写 undefined 判断。 */
  getOrThrow(name: string): string {
    const value = this.values[name];
    if (value === undefined) throw new Error('配置缺失：' + name + '（应在启动校验阶段拦住）');
    return value;
  }

  getNumber(name: string): number {
    const value = this.getOrThrow(name);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error('配置 ' + name + ' 不是数字：' + value);
    return parsed;
  }

  get nodeEnv(): string {
    return this.values.NODE_ENV ?? 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get databaseUrl(): string {
    return this.getOrThrow('DATABASE_URL');
  }

  get cacheTtlSeconds(): number {
    return this.getNumber('CACHE_TTL_SECONDS');
  }

  /** 展示用快照：密钥打码，其余原样返回。 */
  describe(): ConfigEntryView[] {
    return this.schema.map((spec) => ({
      name: spec.name,
      description: spec.description,
      required: spec.required,
      secret: spec.secret === true,
      value: maskValue(spec, this.values[spec.name]),
    }));
  }

  /** 对外可见的安全配置（可以返回给前端/健康检查的字段）。 */
  publicSnapshot() {
    return {
      nodeEnv: this.nodeEnv,
      databaseUrl: maskValue(this.schema.find((spec) => spec.name === 'DATABASE_URL')!, this.values.DATABASE_URL),
      jwtSecret: maskValue(this.schema.find((spec) => spec.name === 'JWT_SECRET')!, this.values.JWT_SECRET),
      port: this.getNumber('PORT'),
      cacheTtlSeconds: this.cacheTtlSeconds,
    };
  }
}
