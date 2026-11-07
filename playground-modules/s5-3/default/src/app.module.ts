import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CryptoService } from './crypto/crypto.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

/**
 * 练习 s5-3 · 密码学与密钥管理
 *
 * 结构：
 *   crypto/crypto.service.ts  scrypt 慢哈希 + AES-256-GCM 加解密 + 脱敏 + 密钥环（k1/k2）
 *   users/users.service.ts    内存用户仓储：入库加密、出参脱敏
 *   users/users.controller.ts /users 读写接口
 *   app.controller.ts         /health 与 /crypto/* 自检接口
 *
 * 建议动手：
 *   1. 访问 /users/1/raw，确认库里没有明文手机号与密码；
 *   2. 把 CURRENT_KID 改成 k1 重新运行，观察新密文前缀变化（k2 密文仍能解）；
 *   3. 改坏密文（去掉一个字符）访问 /users/1，观察 GCM 认证标签导致的解密失败。
 *
 * 真实项目：bcrypt/argon2 做密码哈希、KMS 做数据密钥、DTO 序列化层统一脱敏。
 */
@Module({
  controllers: [AppController, UsersController],
  providers: [CryptoService, UsersService],
})
export class AppModule {}
