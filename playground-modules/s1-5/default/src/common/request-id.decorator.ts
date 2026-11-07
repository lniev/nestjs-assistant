import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 自定义参数装饰器：从 request 上取出中间件写入的 requestId。
 *
 * 等价写法是在 handler 里 `@Req() req` 然后读 req.requestId；
 * 抽成装饰器后控制器不需要依赖 express 的 Request 类型。
 *
 * 真实项目还常见 @CurrentUser() / @TenantId() 这类装饰器。
 */
export const RequestId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest();
  return request.requestId;
});
