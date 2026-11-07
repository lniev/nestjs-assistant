import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { BusinessException, ERROR_CODES } from './errors/business.exception';

/**
 * 演示三种典型错误路径，方便在请求台逐个对比响应契约：
 *   - 404：HttpException（NotFoundException）
 *   - 400：业务异常（BusinessException + 机器可读 code）
 *   - 500：未捕获的普通 Error（堆栈只进日志）
 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', module: 's2-4' };
  }

  /** 存在就走成功分支；不存在抛 HttpException → 404。 */
  @Get('orders/:id')
  findOrder(@Param('id') id: string) {
    if (id !== '1') {
      throw new NotFoundException('订单 #' + id + ' 不存在');
    }
    return { id: 1, amount: 99, status: 'paid' };
  }

  /** 专门演示 404：路由存在但资源不存在。 */
  @Get('missing-order')
  missingOrder(): never {
    throw new NotFoundException('订单 #999 不存在');
  }

  /** 业务校验失败 → 400 + 错误码 ORDER_EMPTY。 */
  @Post('orders')
  createOrder(@Body() body: any) {
    const items = body && Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      throw new BusinessException(
        ERROR_CODES.ORDER_EMPTY,
        '订单至少需要一个商品',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { id: 1001, items, status: 'created' };
  }

  /**
   * 未捕获的普通 Error → 500。
   * 对比：Nest 默认返回 { statusCode: 500, message: 'Internal server error' }；
   * 我们的过滤器只返回稳定错误码，完整堆栈只出现在运行日志里。
   */
  @Get('boom')
  boom(): never {
    throw new Error('boom：模拟数据库连接失败（堆栈仅在服务端日志里）');
  }
}
