import { Controller, Get, Query } from '@nestjs/common';
import { CryptoService } from './crypto/crypto.service';
import { UsersService } from './users/users.service';

/**
 * 加解密自检入口（不写数据库，直接验证算法参数与往返）：
 *   GET /crypto/roundtrip?phone=13800138000
 *   GET /crypto/verify?name=alice&password=s3cret
 *
 * 真实项目里这些逻辑跑在 jest 单测里，不会暴露成 HTTP 接口；
 * 操练场把它们开放出来，是为了在请求台里直接看到密文长什么样。
 */
@Controller()
export class AppController {
  constructor(
    private readonly crypto: CryptoService,
    private readonly users: UsersService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      module: 's5-3',
      topic: '密码学与密钥管理',
      algorithms: { password: 'scrypt (16 字节随机盐)', phone: 'AES-256-GCM', keyRing: 'k1 -> k2 可轮换' },
    };
  }

  @Get('crypto/roundtrip')
  roundtrip(@Query('phone') phone?: string) {
    return this.crypto.roundtrip(typeof phone === 'string' && phone !== '' ? phone : '13800138000');
  }

  @Get('crypto/verify')
  verify(@Query('name') name?: string, @Query('password') password?: string) {
    const ok = this.users.verify(String(name ?? ''), String(password ?? ''));
    return { name: name ?? null, valid: ok, hint: '真实项目：密码走 POST body + TLS，不要放 query' };
  }
}
