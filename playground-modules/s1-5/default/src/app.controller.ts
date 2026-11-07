import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { RequestId } from './common/request-id.decorator';

/** 演示请求生命周期的几个端点。 */
@Controller()
export class AppController {
  @Get('health')
  health(@RequestId() requestId: string) {
    return { status: 'ok', module: 's1-5', requestId, time: new Date().toISOString() };
  }

  /** 返回生命周期顺序，配合日志一起看。 */
  @Get('lifecycle')
  lifecycle() {
    return {
      order: [
        'middleware（RequestIdMiddleware 分配 requestId）',
        'guards（本练习未使用）',
        'interceptors 前半段（RequestIdInterceptor 写响应头、计时）',
        'pipes（参数转换与校验）',
        'handler（控制器方法）',
        'interceptors 后半段',
        'exception filters（异常时兜底）',
      ],
    };
  }

  /** 同一次请求里，中间件写入的 requestId 会被装饰器取出来。 */
  @Get('echo/:id')
  echo(@Param('id') id: string, @RequestId() requestId: string) {
    return { id, requestId, note: '响应头里也有 X-Request-Id' };
  }

  /** 故意抛 400，观察全局异常过滤器把 requestId 带进错误响应。 */
  @Get('boom')
  boom(): never {
    throw new BadRequestException('演示异常：这个 400 也会带上同一个 requestId');
  }
}
