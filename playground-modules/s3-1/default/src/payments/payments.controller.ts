import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** 回显当前注入到的实现、配置，以及 useExisting 别名是否同一实例。 */
  @Get('config')
  config() {
    return this.payments.describe();
  }

  /** POST 默认返回 201；这里用 @HttpCode 显式改成 200，说明状态码也可以声明式配置。 */
  @Post('charge')
  @HttpCode(HttpStatus.OK)
  charge(@Body() body: any) {
    return this.payments.charge({
      orderId: String(body?.orderId ?? 'order-1'),
      amount: Number(body?.amount ?? 100),
      currency: String(body?.currency ?? 'CNY'),
    });
  }
}
