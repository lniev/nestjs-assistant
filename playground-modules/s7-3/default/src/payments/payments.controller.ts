import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

/**
 * 支付 HTTP 入口。
 *
 * 幂等演练（请求台里连发两次即可）：
 *   POST /payments
 *   Header: Idempotency-Key: pay-order-1
 *   Body:   { "amount": 99 }
 * 两次返回的 payment.id 相同、totalCharged 只加一次。
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  charge(@Body() body: Record<string, unknown>, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.paymentsService.charge({
      amount: body?.amount,
      idempotencyKey: idempotencyKey ?? body?.idempotencyKey,
    });
  }

  @Get()
  list() {
    return {
      payments: this.paymentsService.list(),
      hint: 'POST /payments 时带上 Idempotency-Key 请求头，重复请求只会回放第一次的结果',
    };
  }
}
