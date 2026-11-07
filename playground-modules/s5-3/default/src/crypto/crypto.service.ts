import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';

declare const require: any;
declare const Buffer: any;

const crypto = require('node:crypto');

/**
 * 练习 s5-3 · 密码学与密钥管理
 *
 * 两个最容易做错的地方，这个服务各演示一个正确写法：
 *   1. 密码：永远不要自己造哈希，也不要用 SHA-256 直接算。用慢哈希 + 随机盐。
 *      真实项目用 bcrypt 或 argon2（npm i bcrypt / argon2）；这里用 Node 内置的
 *      scrypt（等价强度，参数 N=16384/r=8/p=1）演示，格式与 bcrypt 一样带盐。
 *   2. 敏感字段（手机号）：用对称加密 AES-256-GCM（带认证标签），
 *      密钥从 KMS / 环境变量读取，不写进代码。这里为了能离线运行，把
 *      「密钥环」写死在常量里，并在注释里标明生产做法。
 *
 * 密钥轮换：密文前缀带 kid（key id），解密时按 kid 取对应密钥，
 * 所以加密换成 k2 之后，k1 加密的历史数据仍能读出来（keys 里保留 k1）。
 */

/** 演示用的 32 字节密钥（AES-256）。生产：从 AWS KMS / Vault 取，绝不入库、不入代码。 */
const KEYS: Record<string, any> = {
  k1: Buffer.from('9f2c1f7b6d4e8a0b3c5d7e9f1a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b', 'hex'),
  k2: Buffer.from('1a3b5c7d9e0f2a4c6b8d0e2f4a6c8b0d2e4f6a8c0e2d4f6b8d0a2c4e6f8b0d2e', 'hex'),
};

/** 当前加密用的密钥版本；轮换时把它改成 k2，k1 保留用于解历史密文。 */
const CURRENT_KID = 'k2';

export interface EncryptedValue {
  payload: string;
  kid: string;
}

@Injectable()
export class CryptoService {
  /** 随机 12 字节 IV：GCM 下绝不复用 (key, iv) 组合，所以每次加密都重新生成。 */
  encrypt(plain: string): string {
    const kid = CURRENT_KID;
    const key = KEYS[kid];
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', kid, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  /** 解密：按密文里的 kid 找密钥，GCM 会校验 tag，被篡改直接抛错。 */
  decrypt(payload: string): string {
    const parts = String(payload).split('.');
    if (parts.length !== 5 || parts[0] !== 'v1') {
      throw new BadRequestException({ code: 'CRYPTO_PAYLOAD_INVALID', message: '密文格式不正确' });
    }
    const [, kid, ivB64, tagB64, dataB64] = parts;
    const key = KEYS[kid];
    if (!key) {
      // 真实项目里这里是 KMS 的 Decrypt 调用；key 缺失说明密钥轮换时删早了。
      throw new BadRequestException({ code: 'CRYPTO_KEY_UNKNOWN', message: '未知密钥版本：' + kid });
    }
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
    } catch (_error) {
      throw new BadRequestException({ code: 'CRYPTO_DECRYPT_FAILED', message: '解密失败：密文或密钥不匹配' });
    }
  }

  /**
   * 慢哈希：scrypt + 16 字节随机盐。
   * 输出格式 scrypt$<salt>$<hash>，和 bcrypt 的 $2b$10$... 思路一致。
   * 真实项目：await bcrypt.hash(password, 12) / argon2id。
   */
  hashPassword(password: string): string {
    if (typeof password !== 'string' || password.length < 6) {
      throw new BadRequestException({ code: 'PASSWORD_TOO_WEAK', message: '密码至少 6 位' });
    }
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 32);
    return ['scrypt', salt.toString('base64url'), hash.toString('base64url')].join('$');
  }

  /** 校验密码：一定要用 timingSafeEqual，避免按字节比较泄露时间信息。 */
  verifyPassword(password: string, stored: string): boolean {
    const parts = String(stored).split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const expected = Buffer.from(parts[2], 'base64url');
    const actual = crypto.scryptSync(String(password), Buffer.from(parts[1], 'base64url'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  }

  /** 脱敏展示：13800138000 -> 138****8000。真实项目在 DTO 序列化层统一做。 */
  maskPhone(phone: string): string {
    const value = String(phone);
    if (value.length <= 7) return '****';
    return value.slice(0, 3) + '****' + value.slice(value.length - 4);
  }

  /** 给 /crypto/roundtrip 用的自检：加密 -> 解密 -> 比较。 */
  roundtrip(plain: string) {
    const payload = this.encrypt(plain);
    const decrypted = this.decrypt(payload);
    return {
      plain,
      payload,
      decrypted,
      equal: decrypted === plain,
      note: 'payload 是库里真正存的形状：v1.<kid>.<iv>.<tag>.<ciphertext>',
    };
  }
}
