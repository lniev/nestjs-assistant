import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CatsModule } from './cats/cats.module';

/**
 * 练习 s2-2 · 守卫与访问控制
 *
 * 守卫（Guard）只回答一个问题：这个请求能不能继续？
 *   - 在中间件之后、拦截器/管道之前执行，所以「无权限」的请求连参数都不会被校验；
 *   - 用 @SetMetadata + Reflector 读取路由上的角色要求；
 *   - 未登录 → 401 Unauthorized，已登录但角色不够 → 403 Forbidden。
 *
 * 本练习用 Authorization: Bearer <token> 模拟登录态：
 *   admin-token → admin 角色
 *   user-token  → user 角色
 * 真实项目会换成 JWT 校验（@nestjs/jwt + passport），把解析出的 user 挂到 request 上。
 *
 * 建议动手：
 *   1. 请求台里 DELETE /cats/1（不带 Authorization）→ 401；
 *   2. 带 user-token → 403；带 admin-token → 200；
 *   3. 给 GET /cats/:id 也加 @Roles('user')，观察守卫先于 ParseIntPipe 执行：
 *      DELETE /cats/abc 会先返回 401 而不是 400。
 */
@Module({
  imports: [CatsModule],
  controllers: [AppController],
})
export class AppModule {}
