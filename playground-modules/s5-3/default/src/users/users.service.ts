import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';

/**
 * 「数据库」里的一行：密码与手机号都不是明文。
 * 真实项目里这就是 User 实体 + 加密列（或列级加密 / 字段加密存储）。
 */
export interface UserRow {
  id: number;
  name: string;
  role: 'customer' | 'staff';
  passwordHash: string;
  phoneCipher: string;
}

export interface UserDto {
  id: number;
  name: string;
  role: string;
  phoneMasked: string;
}

const SEED = [
  { id: 1, name: 'alice', role: 'customer' as const, password: 's3cret', phone: '13800138000' },
  { id: 2, name: 'bob', role: 'customer' as const, password: 'hunter2', phone: '13912345678' },
];

/**
 * 用户仓储 + 展示层。
 *
 * 入库时：password -> 慢哈希，phone -> AES-GCM 密文。
 * 出参时：phone -> 解密后立即脱敏，绝不把明文手机号返回给前端。
 */
@Injectable()
export class UsersService {
  private readonly rows: UserRow[] = [];

  constructor(private readonly crypto: CryptoService) {
    let nextId = 1;
    for (const user of SEED) {
      this.rows.push({
        id: nextId,
        name: user.name,
        role: user.role,
        passwordHash: this.crypto.hashPassword(user.password),
        phoneCipher: this.crypto.encrypt(user.phone),
      });
      nextId += 1;
    }
  }

  listMasked(): UserDto[] {
    return this.rows.map((row) => this.toDto(row));
  }

  findMasked(id: number): UserDto {
    return this.toDto(this.findRow(id));
  }

  /** 给 /users/:id/raw 用：证明库里只有密文与哈希（注意 passwordHash 也永远不返回给前端）。 */
  findRaw(id: number) {
    const row = this.findRow(id);
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      phoneCipher: row.phoneCipher,
      passwordHash: row.passwordHash,
      note: '以上是数据库里的真实值：手机号是密文，密码是慢哈希，看不到明文',
    };
  }

  create(dto: { name?: string; password?: string; phone?: string; role?: string }): UserDto {
    const name = typeof dto?.name === 'string' ? dto.name.trim() : '';
    if (name === '') throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'name 不能为空' });
    if (this.rows.some((row) => row.name === name)) {
      throw new BadRequestException({ code: 'NAME_TAKEN', message: '用户名已存在' });
    }
    const phone = typeof dto?.phone === 'string' ? dto.phone.trim() : '';
    if (!/^1\d{10}$/.test(phone)) {
      throw new BadRequestException({ code: 'PHONE_INVALID', message: 'phone 需要 11 位手机号' });
    }
    const row: UserRow = {
      id: this.rows.length + 1,
      name,
      role: dto?.role === 'staff' ? 'staff' : 'customer',
      passwordHash: this.crypto.hashPassword(dto?.password),
      phoneCipher: this.crypto.encrypt(phone),
    };
    this.rows.push(row);
    return this.toDto(row);
  }

  /** 登录校验示例：只比哈希，不接触明文密码。 */
  verify(name: string, password: string): boolean {
    const row = this.rows.find((item) => item.name === name);
    if (!row) return false;
    return this.crypto.verifyPassword(password, row.passwordHash);
  }

  private toDto(row: UserRow): UserDto {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      phoneMasked: this.crypto.maskPhone(this.crypto.decrypt(row.phoneCipher)),
    };
  }

  private findRow(id: number): UserRow {
    const row = this.rows.find((item) => item.id === id);
    if (!row) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户 #' + id + ' 不存在' });
    }
    return row;
  }
}
