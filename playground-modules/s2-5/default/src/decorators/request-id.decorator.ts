import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestIdInfo {
  requestId: string;
  handler: string;
  controller: string;
}

/**
 * @RequestId()                       → 当前请求的 requestId 字符串
 * @RequestId({ withHandler: true })  → 额外带上「哪个控制器/处理器在处理」
 *
 * 演示 ExecutionContext 的另外两个能力：
 *   ctx.getHandler() 返回当前路由处理方法，ctx.getClass() 返回控制器类，
 *   日志、审计、限流等横切逻辑常用它们标注「是哪段代码在处理请求」。
 *   真实项目里还可以用 ctx.getType() 判断 'http' / 'rpc' / 'ws' 再分别取值。
 */
export const RequestId = createParamDecorator(
  (
    data: { withHandler?: boolean } | undefined,
    ctx: ExecutionContext,
  ): string | RequestIdInfo => {
    const request = ctx.switchToHttp().getRequest<any>();
    const requestId = String(
      request?.requestId ?? request?.headers?.['x-request-id'] ?? 'unknown',
    );
    if (data?.withHandler) {
      const handler = ctx.getHandler();
      const controller = ctx.getClass();
      return {
        requestId,
        handler: handler?.name ?? 'anonymous',
        controller: controller?.name ?? 'anonymous',
      };
    }
    return requestId;
  },
);
