import { Module } from '@nestjs/common';
import { DownstreamService } from './downstream/downstream.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { ShippingController } from './shipping/shipping.controller';

/**
 * 练习 s7-3 · 超时、重试、熔断与幂等
 *
 * 这一套默认代码保护一个「很慢的外部物流服务」，并演示支付幂等键：
 *   - 超时：withTimeout 给单次调用设上限，超时抛 TimeoutError；
 *   - 重试：只对幂等操作重试（GET 报价），指数退避，且次数很少，避免放大故障；
 *   - 熔断：连续失败达到阈值后打开，直接返回兜底报价，冷却期后进入半开试探；
 *   - 降级：GET /shipping/quote/:id 永远返回 200 + degraded 标记（也可改成 504）；
 *   - 幂等：POST /payments 带 Idempotency-Key，重复请求只扣一次款。
 *
 * 真实项目替换方式（未安装这些包）：
 *   - 熔断/重试/超时：cockatiel / opossum，或 @nestjs/axios + rxjs timeout/retry；
 *   - 幂等键：Redis SET NX 或数据库唯一索引（order_id + idempotency_key），
 *     同一 key 的重复请求返回第一次的结果。
 *
 * 故障演练：
 *   1) POST /shipping/downstream { "delayMs": 300 } 把下游变慢；
 *   2) 连续访问 GET /shipping/quote/1 观察超时与重试；
 *   3) 失败满 3 次后 GET /shipping/circuit 看到 state=open，
 *      此时请求直接走兜底；等 5 秒后自动变 half-open 再试探；
 *   4) POST /shipping/reset 恢复。
 */
@Module({
  controllers: [ShippingController, PaymentsController],
  providers: [DownstreamService, PaymentsService],
})
export class AppModule {}
