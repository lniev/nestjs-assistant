import { Injectable } from '@nestjs/common';
import { hashPassword } from './security';

/**
 * 练习 s5-1 · 用户仓储（内存表，等价于 TypeORM 的 Repository<User>）
 *
 * 真实项目：@Entity() User + @InjectRepository(User) repo: Repository<User>，
 * 密码哈希存在 user.passwordHash 列，任何接口都不得把它返回给客户端。
 */

export interface UserRecord {
  id: number;
  email: string;
  name: string;
  /** scrypt 哈希 + 盐；绝不存明文，也绝不返回给客户端。 */
  passwordHash: string;
  createdAt: string;
}

/** 对外可见的用户信息（去掉 passwordHash）。 */
export type PublicUser = Omit<UserRecord, 'passwordHash'>;

@Injectable()
export class UserRepository {
  private readonly users: UserRecord[] = [];
  private nextId = 1;

  constructor() {
    // 预置演示账号：alice@example.com / Passw0rd!
    // 也可以走 POST /auth/register 自己注册（密码至少 8 位）。
    this.users.push(this.createRecord('alice@example.com', 'Alice', 'Passw0rd!'));
  }

  private createRecord(email: string, name: string, password: string): UserRecord {
    const record: UserRecord = {
      id: this.nextId,
      email: email.toLowerCase(),
      name,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    this.nextId += 1;
    return record;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === String(email).toLowerCase()) ?? null;
  }

  async findById(id: number): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async create(input: { email: string; name: string; password: string }): Promise<UserRecord> {
    // 真实项目由数据库唯一索引兜底；这里内存表也先查重再插入。
    const record = this.createRecord(input.email, input.name, input.password);
    this.users.push(record);
    return record;
  }

  async count(): Promise<number> {
    return this.users.length;
  }

  /** 统一的「脱敏」出口：凡是返回用户对象的地方都走它。 */
  toPublic(user: UserRecord): PublicUser {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
