/**
 * 练习 s4-3 · 配置 schema 与启动校验
 *
 * 真实项目用 @nestjs/config + Joi / zod / class-validator 的 validate：
 *
 *   ConfigModule.forRoot({
 *     isGlobal: true,
 *     envFilePath: ['.env.local', '.env'],
 *     validate: (raw) => joiSchema.validate(raw, { abortEarly: false }),
 *   })
 *
 * 校验发生在**模块初始化阶段**，所以缺变量时应用根本起不来，而不是等第一个请求
 * 才在 service 里发现 config.get('DATABASE_URL') 是 undefined。
 * 操练场没有 .env，也无法读部署平台的环境变量，所以用 PLAYGROUND_ENV_PRESET
 * 提供可运行的默认值；把其中任意一行删掉再点「运行」，就能看到启动失败。
 */

export type EnvVarKind = 'string' | 'int' | 'url' | 'enum';

export interface EnvVarSpec {
  name: string;
  required: boolean;
  kind: EnvVarKind;
  secret?: boolean;
  minLength?: number;
  values?: string[];
  default?: string;
  description: string;
}

export interface EnvValidationIssue {
  variable: string;
  message: string;
}

/** 启动校验失败时抛出的错误：message 里逐条列出变量名与原因。 */
export class EnvValidationError extends Error {
  readonly issues: EnvValidationIssue[];

  constructor(issues: EnvValidationIssue[]) {
    super(
      '环境变量校验失败（应用启动中止）：\n' +
        issues.map((issue) => '  - ' + issue.variable + '：' + issue.message).join('\n'),
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/** 配置契约：只允许从环境变量读，密钥绝不写进代码仓库。 */
export const ENV_SCHEMA: EnvVarSpec[] = [
  {
    name: 'NODE_ENV',
    required: false,
    kind: 'enum',
    values: ['development', 'test', 'production'],
    default: 'development',
    description: '运行环境',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    kind: 'url',
    description: '数据库连接串（如 postgres://user:pass@host:5432/db）',
  },
  {
    name: 'JWT_SECRET',
    required: true,
    kind: 'string',
    secret: true,
    minLength: 16,
    description: '令牌签名密钥（至少 16 字符，只从环境变量注入）',
  },
  {
    name: 'PORT',
    required: false,
    kind: 'int',
    default: '3000',
    description: '监听端口（操练场由 runner 用 0 端口，这里只做展示）',
  },
  {
    name: 'CACHE_TTL_SECONDS',
    required: false,
    kind: 'int',
    default: '60',
    description: '缓存 TTL（秒）',
  },
];

/**
 * 操练场预设值：等价于本地 .env 文件。
 * 练习：删掉 DATABASE_URL 这一行后再运行 → 启动阶段立即失败，日志里指出变量名。
 */
export const PLAYGROUND_ENV_PRESET: Record<string, string> = {
  DATABASE_URL: 'memory://playground',
  JWT_SECRET: 'playground-only-secret-change-me',
};

function checkValue(spec: EnvVarSpec, value: string): string | null {
  if (spec.kind === 'int') {
    if (!/^\d+$/.test(value)) return '必须是正整数，实际收到「' + value + '」';
    return null;
  }
  if (spec.kind === 'url') {
    if (!/^[a-z][a-z0-9+.-]*:\/\/.+/i.test(value)) return '必须是合法连接串（如 postgres://...），实际收到「' + value + '」';
    return null;
  }
  if (spec.kind === 'enum') {
    const allowed = spec.values ?? [];
    if (allowed.indexOf(value) < 0) return '只能是 ' + allowed.join(' / ') + '，实际收到「' + value + '」';
    return null;
  }
  if (spec.minLength !== undefined && value.length < spec.minLength) {
    return '长度至少 ' + String(spec.minLength) + ' 字符';
  }
  return null;
}

/**
 * 按 schema 校验并返回强类型的配置对象；出错抛 EnvValidationError（一次列出全部问题）。
 * @param raw 原始环境变量
 * @param useDefaults 是否使用 schema 里的默认值；false 用于「严格校验」演示
 */
export function validateEnv(raw: Record<string, string | undefined>, useDefaults = true): Record<string, string> {
  const values: Record<string, string> = {};
  const issues: EnvValidationIssue[] = [];

  for (const spec of ENV_SCHEMA) {
    const provided = raw[spec.name];
    let value = typeof provided === 'string' && provided.trim() !== '' ? provided.trim() : undefined;
    if (value === undefined && useDefaults) value = spec.default;
    if (value === undefined) {
      if (spec.required) issues.push({ variable: spec.name, message: '缺少必填变量（' + spec.description + '）' });
      continue;
    }
    const problem = checkValue(spec, value);
    if (problem !== null) {
      issues.push({ variable: spec.name, message: problem });
      continue;
    }
    values[spec.name] = value;
  }

  if (issues.length > 0) throw new EnvValidationError(issues);
  return values;
}

/** 给 /config 路由展示用：密钥打码。 */
export function maskValue(spec: EnvVarSpec, value: string | undefined): string {
  if (value === undefined) return '(未设置)';
  return spec.secret ? '***（已设置，长度 ' + String(value.length) + '）' : value;
}
