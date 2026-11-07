import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { DownstreamService } from '../downstream/downstream.service';
import { CircuitBreaker, withRetry, withTimeout } from '../resilience/resilience';

/**
 * 物流报价接口：完整演示「超时 + 重试 + 熔断 + 降级」。
 *
 * 真实的调用链通常是：
 *   Service → @nestjs/axios HttpService → 物流网关
 * 这里把下游换成 DownstreamService（内存版），其余逻辑完全一致。
 */

const TIMEOUT_MS = 200;

@Controller()
export class ShippingController {
  private readonly breaker = new CircuitBreaker({
    failureThreshold: 3,
    cooldownMs: 5000,
    halfOpenMaxCalls: 1,
  });

  constructor(private readonly downstream: DownstreamService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 's7-3', circuit: this.breaker.state };
  }

  /**
   * 查询物流报价。
   * 熔断打开时直接返回兜底值（HTTP 200 + degraded:true）；
   * 也可以按业务改成返回 504 Gateway Timeout —— 降级策略由业务决定。
   */
  @Get('shipping/quote/:id')
  async quote(@Param('id') id: string) {
    const orderId = Number(id) > 0 ? Number(id) : 1;

    if (!this.breaker.canRequest()) {
      return this.degraded(orderId, '熔断器已打开：不再调用下游，直接返回兜底报价');
    }

    try {
      // 只对幂等的查询（GET 报价）重试；支付类写操作绝不能盲目重试。
      const quote = await withRetry(
        () => withTimeout(this.downstream.fetchQuote(orderId), TIMEOUT_MS, '物流下游'),
        { attempts: 2, baseDelayMs: 20, maxDelayMs: 60 },
      );
      this.breaker.onSuccess();
      return {
        ok: true,
        degraded: false,
        circuit: this.breaker.snapshot(),
        quote,
      };
    } catch (error) {
      this.breaker.onFailure();
      const message = error instanceof Error ? error.message : String(error);
      return this.degraded(orderId, message + '（已重试，仍失败）');
    }
  }

  @Get('shipping/circuit')
  circuit() {
    return {
      circuit: this.breaker.snapshot(),
      downstream: this.downstream.status(),
      drill: {
        slowDown: 'POST /shipping/downstream { "delayMs": 300 }',
        recover: 'POST /shipping/reset',
        timeoutMs: TIMEOUT_MS,
      },
    };
  }

  /** 故障注入：调整下游延迟 / 失败次数，然后观察熔断器状态变化。 */
  @Post('shipping/downstream')
  @HttpCode(HttpStatus.OK)
  configure(@Body() body: Record<string, unknown>) {
    const downstream = this.downstream.configure({ delayMs: body?.delayMs, failures: body?.failures });
    return { ok: true, downstream, hint: '连续请求 GET /shipping/quote/1 直到 circuit.state 变为 open' };
  }

  @Post('shipping/reset')
  @HttpCode(HttpStatus.OK)
  reset() {
    this.breaker.reset();
    const downstream = this.downstream.reset();
    return { ok: true, circuit: this.breaker.snapshot(), downstream };
  }

  /** 兜底报价：外部依赖不可用时保证接口仍可用（价格/时效是保守值）。 */
  private degraded(orderId: number, reason: string) {
    return {
      ok: true,
      degraded: true,
      circuit: this.breaker.snapshot(),
      quote: {
        orderId,
        carrier: 'SF Express（兜底）',
        etaDays: 3,
        price: 25,
        source: 'fallback',
        reason,
        at: new Date().toISOString(),
      },
    };
  }
}
