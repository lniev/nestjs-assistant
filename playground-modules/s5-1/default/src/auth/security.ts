import { Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * 练习 s5-1 · 手写「JWT 风格」令牌服务 + 密码慢哈希（node:crypto）
 *
 * 真实项目直接用 @nestjs/jwt + bcrypt:
 *
 *   JwtModule.registerAsync({
 *     inject: [ConfigService],
 *     useFactory: (config) => ({
 *       secret: config.getOrThrow('JWT_SECRET'),
 *       signOptions: { expiresIn: '15m' },
 *     }),
 *   })
 *   this.jwt.signAsync(payload) / this.jwt.verifyAsync(token)
 *   bcrypt.hash(password, 12) / bcrypt.compare(...)
 *
 * 操练场没有安装这些包，所以用 node 内置 crypto 等价实现：
 *   - 令牌结构 header.payload.signature（HMAC-SHA256），只演示签名/过期校验；
 *   - 密码用 scrypt 慢哈希 + 随机盐（bcrypt 的等价物），绝不存明文；
 *   - 密钥从环境变量读，操练场给默认值，生产必须由部署平台注入。
 *
 * ⚠️ 真实项目不要手写 JWT/密码算法，用成熟库并保持依赖更新。
 */

// 操练场的 tsconfig 没装 @types/node；这里声明用到的 node 内置 API（真实项目可直接 import）。
declare const require: (id: string) => any;
declare const Buffer: {
  from(input: string, encoding?: string): {
    toString(encoding?: string): string;
    length: number;
    [index: number]: number;
  };
};

const crypto = require('node:crypto') as {
  createHmac: (algorithm: string, key: string) => { update(data: string): { digest(encoding: 'base64url'): string } };
  randomBytes: (size: number) => { toString(encoding: 'hex'): string };
  randomUUID: () => string;
  scryptSync: (password: string, salt: string, keylen: number) => {
    toString(encoding: 'hex'): string;
    length: number;
    [index: number]: number;
  };
  timingSafeEqual: (left: unknown, right: unknown) => boolean;
};

/** 慢哈希：scrypt（bcrypt 等价物）+ 每用户随机盐。 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + derived;
}

/** 校验密码：用同样参数重算再 timingSafeEqual，避免时序侧信道。 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const derived = crypto.scryptSync(password, parts[1], 64);
  const expected = Buffer.from(parts[2], 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export interface TokenPayload {
  /** 用户 id（JWT 标准 sub） */
  sub: number;
  /** 会话 id：登出/轮换时吊销整条会话 */
  sid: string;
  /** access 用于访问接口，refresh 只能用于换新令牌 */
  typ: 'access' | 'refresh';
  /** 令牌唯一 id：refresh 一次性使用靠它判断是否被重放 */
  jti: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  refreshJti: string;
}

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class TokenService {
  private readonly secret: string;

  constructor() {
    const runtime = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    this.secret = runtime.process?.env?.JWT_SECRET ?? 'playground-only-secret-change-me';
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private sign(data: string): string {
    return crypto.createHmac('sha256', this.secret).update(data).digest('base64url');
  }

  private createToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, ttlSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const body: TokenPayload = { ...payload, iat: now, exp: now + ttlSeconds };
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payloadPart = this.encode(body);
    return header + '.' + payloadPart + '.' + this.sign(header + '.' + payloadPart);
  }

  /** 登录成功后签发一对令牌；refreshJti 交给会话存储做「一次性使用」判断。 */
  issueTokens(userId: number, sessionId: string): TokenPair {
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();
    return {
      accessToken: this.createToken({ sub: userId, sid: sessionId, typ: 'access', jti: accessJti }, ACCESS_TTL_SECONDS),
      refreshToken: this.createToken({ sub: userId, sid: sessionId, typ: 'refresh', jti: refreshJti }, REFRESH_TTL_SECONDS),
      accessExpiresIn: ACCESS_TTL_SECONDS,
      refreshExpiresIn: REFRESH_TTL_SECONDS,
      refreshJti,
    };
  }

  /** 校验签名、类型与过期时间；任何一项不通过都抛 401。 */
  verify(token: string, expectedType: 'access' | 'refresh'): TokenPayload {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) throw new UnauthorizedException('令牌格式不正确（应为 header.payload.signature）');

    const [header, payloadPart, signature] = parts;
    const expected = this.sign(header + '.' + payloadPart);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw new UnauthorizedException('令牌签名无效');
    }

    let payload: TokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as TokenPayload;
    } catch (_error) {
      throw new UnauthorizedException('令牌内容无法解析');
    }
    if (payload.typ !== expectedType) {
      throw new UnauthorizedException('令牌类型不匹配：需要 ' + expectedType + '，收到 ' + String(payload.typ));
    }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('令牌已过期，请用 refreshToken 换取新令牌');
    }
    return payload;
  }
}
