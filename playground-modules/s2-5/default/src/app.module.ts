import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthMiddleware } from './middleware/auth.middleware';

/**
 * 练习 s2-5 · 自定义装饰器与执行上下文
 *
 * 分工：
 *   - AuthMiddleware 负责把 user / requestId 挂到原生请求上（真实项目在这里校验 JWT）；
 *   - @CurrentUser() / @RequestId() 用 createParamDecorator + ExecutionContext 把
 *     请求信息变成语义化参数，控制器不再注入整个 @Req()。
 *
 * 建议动手：
 *   1. 请求台带上请求头 x-user-id: 2，再调 /me 与 /me/role，观察用户变化；
 *   2. 给 @CurrentUser() 增加「取不到用户就抛 UnauthorizedException」的行为；
 *   3. 给 @RequestId() 加一个 applyDecorators() 组合（例如同时写 SetMetadata）。
 */
@Module({ controllers: [AppController] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // '*path' 是 Nest 11 / Express 5 的具名通配写法（旧版本可以写 '*'）。
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
