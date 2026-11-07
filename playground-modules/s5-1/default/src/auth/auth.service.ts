import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService, hashPassword, verifyPassword } from './security';
import { PublicUser, UserRepository, UserRecord } from './user.repository';

/**
 * 练习 s5-1 · 认证用例：注册 / 登录 / 刷新 / 登出 / 校验
 *
 * 设计要点：
 *   1. accessToken 短命（15 分钟），refreshToken 长命（7 天）且**一次性使用**；
 *   2. 每次刷新都会轮换 refreshToken，旧令牌再被使用视为「重放」，直接吊销整个会话；
 *   3. 登出 = 把会话标记为 revoked，accessToken 即使没过期也立刻失效（服务端会话校验）；
 *   4. 登录失败计数，连续 5 次锁定 60 秒（真实项目用 Redis 计数）。
 *
 * 取舍：pure JWT 是无状态的（不用查会话表），但无法「立即登出」；
 * 这里保留服务端会话表，等于在 JWT 之上补了撤销能力，代价是每次请求查一次内存/Redis。
 */

export interface Session {
  id: string;
  userId: number;
  /** 当前有效的 refreshToken jti：刷新后立刻替换，旧值即为已使用。 */
  refreshJti: string;
  revoked: boolean;
  createdAt: number;
}

export interface AuthResult {
  user: PublicUser;
  tokenType: 'Bearer';
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, Session>();
  private readonly attempts = new Map<string, { failures: number; blockedUntil: number }>();

  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  private startSession(user: UserRecord, sessionId?: string): AuthResult {
    const sid = sessionId ?? 'sid-' + Math.random().toString(36).slice(2, 10);
    const pair = this.tokens.issueTokens(user.id, sid);
    this.sessions.set(sid, {
      id: sid,
      userId: user.id,
      refreshJti: pair.refreshJti,
      revoked: false,
      createdAt: Date.now(),
    });
    return {
      user: this.users.toPublic(user),
      tokenType: 'Bearer',
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessExpiresIn: pair.accessExpiresIn,
      refreshExpiresIn: pair.refreshExpiresIn,
    };
  }

  async register(input: { email?: string; password?: string; name?: string }): Promise<AuthResult> {
    const email = typeof input?.email === 'string' ? input.email.trim() : '';
    const password = typeof input?.password === 'string' ? input.password : '';
    const name = typeof input?.name === 'string' && input.name.trim() !== '' ? input.name.trim() : email.split('@')[0];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('email 必须是合法邮箱');
    if (password.length < 8) throw new BadRequestException('password 至少 8 位');
    if (await this.users.findByEmail(email)) throw new ConflictException('邮箱已被注册');
    const user = await this.users.create({ email, name, password });
    return this.startSession(user);
  }

  async login(input: { email?: string; password?: string }): Promise<AuthResult> {
    const email = typeof input?.email === 'string' ? input.email.trim() : '';
    const password = typeof input?.password === 'string' ? input.password : '';
    if (email === '' || password === '') throw new UnauthorizedException('邮箱或密码错误');

    this.assertNotLocked(email);
    const user = await this.users.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      this.recordFailure(email);
      throw new UnauthorizedException('邮箱或密码错误');
    }
    this.attempts.delete(email);
    return this.startSession(user);
  }

  /** 用 refreshToken 换新的一对令牌；同一 refreshToken 只能用一次。 */
  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (typeof refreshToken !== 'string' || refreshToken === '') {
      throw new UnauthorizedException('缺少 refreshToken');
    }
    const payload = this.tokens.verify(refreshToken, 'refresh');
    const session = this.sessions.get(payload.sid);
    if (!session || session.revoked) throw new UnauthorizedException('会话已失效，请重新登录');
    if (session.refreshJti !== payload.jti) {
      // 旧 refreshToken 被再次使用：视为令牌重放，吊销整条会话（真实项目吊销整个 token family）。
      session.revoked = true;
      throw new UnauthorizedException('刷新令牌已使用过，会话已吊销，请重新登录');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('用户不存在');
    // 轮换：旧 refresh 立即失效，签发新的 access + refresh
    return this.startSession(user, payload.sid);
  }

  /** 登出：吊销服务端会话，旧 accessToken 立刻失效（即使它还没到期）。 */
  logout(sessionId: string): { ok: true; sessionId: string } {
    const session = this.sessions.get(sessionId);
    if (!session) throw new UnauthorizedException('会话不存在');
    session.revoked = true;
    return { ok: true, sessionId };
  }

  /** 校验 accessToken：签名 + 过期 + 会话是否被吊销。 */
  async verifyAccessToken(accessToken: string): Promise<{ user: PublicUser; sessionId: string }> {
    const payload = this.tokens.verify(accessToken, 'access');
    const session = this.sessions.get(payload.sid);
    if (!session || session.revoked) throw new UnauthorizedException('会话已失效，请重新登录');
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('用户不存在');
    return { user: this.users.toPublic(user), sessionId: payload.sid };
  }

  /** 操练场便利入口：直接给演示账号发一对令牌，方便复制去调 /auth/me。 */
  async demoLogin(): Promise<AuthResult & { note: string }> {
    const user = await this.users.findByEmail('alice@example.com');
    if (!user) throw new UnauthorizedException('演示用户不存在');
    return {
      ...this.startSession(user),
      note: '真实登录请 POST /auth/login { "email":"alice@example.com","password":"Passw0rd!" }',
    };
  }

  private assertNotLocked(email: string): void {
    const attempt = this.attempts.get(email.toLowerCase());
    if (attempt && attempt.blockedUntil > Date.now()) {
      const seconds = Math.ceil((attempt.blockedUntil - Date.now()) / 1000);
      throw new HttpException('登录失败次数过多，请 ' + String(seconds) + ' 秒后重试', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailure(email: string): void {
    const key = email.toLowerCase();
    const attempt = this.attempts.get(key) ?? { failures: 0, blockedUntil: 0 };
    attempt.failures += 1;
    if (attempt.failures >= MAX_FAILED_ATTEMPTS) {
      attempt.blockedUntil = Date.now() + LOCK_SECONDS * 1000;
      attempt.failures = 0;
    }
    this.attempts.set(key, attempt);
  }
}
