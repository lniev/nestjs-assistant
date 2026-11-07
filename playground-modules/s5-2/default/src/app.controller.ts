import { Controller, Get } from '@nestjs/common';

/** 健康检查：验证启动链路，并提示可用哪些 ?as= 身份。 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      module: 's5-2',
      topic: '授权：策略与 RBAC',
      actors: {
        1: 'alice（customer，拥有订单 1、3）',
        2: 'bob（customer，拥有订单 2）',
        9: 'staff（可读任意订单）',
        10: 'admin（全部权限）',
      },
      hint: 'GET /orders/2?as=1 越权返回 403；不带 ?as= 返回 401',
    };
  }
}
