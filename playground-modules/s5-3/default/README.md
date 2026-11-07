# 密码学与密钥管理

密码用 scrypt 慢哈希（随机盐 + timingSafeEqual），手机号用 AES-256-GCM 加密入库（node:crypto），出参解密后脱敏成 138****8000；密钥环 k1→k2 支持轮换。GET /users/1/raw 能直接看到库里只有密文与哈希，/crypto/roundtrip 演示加解密往返。

## 练习

在操练场把用户手机号加密入库，再在返回 DTO 时做脱敏展示。

## 运行

在「NestJS 助手 · 操练场」里选中文模块后点「运行」即可；本目录就是该模块的默认代码。

真实项目里的等价命令：

```bash
npm install
npm run start:dev     # 或 npm run build && npm run start:prod
```

## 默认路由

- `GET /health`
- `GET /users`
- `GET /users/1`
- `GET /users/1/raw`
- `GET /crypto/roundtrip?phone=13800138000`
- `GET /crypto/verify?name=alice&password=s3cret`
- `POST /users`
