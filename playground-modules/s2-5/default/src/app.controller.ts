import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequestId } from './decorators/request-id.decorator';
import type { CurrentUserPayload } from './middleware/auth.middleware';

/**
 * 对比一下参数风格：
 *
 *   旧写法：@Req() req: any  → 方法体里 req.user.role、req.requestId 到处翻
 *   新写法：@CurrentUser('role') role、@RequestId() requestId → 参数自己说明语义
 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', module: 's2-5' };
  }

  /** 直接拿到用户对象与请求 ID。 */
  @Get('me')
  me(
    @CurrentUser() user: CurrentUserPayload,
    @RequestId() requestId: string,
  ) {
    return { user, requestId };
  }

  /** 只取用户对象里的 role 字段：@CurrentUser('role')。 */
  @Get('me/role')
  role(@CurrentUser('role') role: string) {
    return { role, hint: '试试带请求头 x-user-id: 2 再请求一次' };
  }

  /** ExecutionContext 额外信息：当前处理器与控制器名。 */
  @Get('context')
  context(@RequestId({ withHandler: true }) info: unknown) {
    return info;
  }
}
