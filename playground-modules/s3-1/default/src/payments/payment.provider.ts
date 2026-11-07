import { Injectable } from '@nestjs/common';

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
}

export interface PaymentResult {
  provider: string;
  transactionId: string;
  amount: number;
  currency: string;
}

/** useFactory 产出的 HTTP 客户端配置（真实项目会是 axios 实例 / fetch 封装）。 */
export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs: number;
  retries: number;
}

/** useValue 注入的应用元信息。 */
export interface AppInfo {
  name: string;
  version: string;
}

/** Symbol 令牌：适合模块内部依赖，避免与别人的字符串令牌撞名。 */
export const HTTP_CLIENT = Symbol('HTTP_CLIENT');
/** 字符串令牌：跨模块 / 跨包共享时更直观。 */
export const PAYMENT_PROVIDER_ALIAS = 'PAYMENT_PROVIDER_ALIAS';
export const APP_INFO = 'APP_INFO';

/**
 * 抽象类令牌：
 *   - interface 在编译后被擦除，不能当注入令牌；
 *   - 抽象类既是运行时存在的「契约」，又能直接当令牌用，业务代码只依赖它。
 * 真实项目正是用这种写法解耦第三方 SDK 与业务实现，测试时换一个 mock 实现即可。
 */
export abstract class PaymentProvider {
  abstract readonly name: string;
  abstract charge(request: PaymentRequest): PaymentResult;
}

/** 沙箱实现：不会真的扣款。 */
@Injectable()
export class SandboxPaymentProvider extends PaymentProvider {
  readonly name = 'sandbox-stub';

  charge(request: PaymentRequest): PaymentResult {
    return {
      provider: this.name,
      transactionId: 'sbx_' + request.orderId,
      amount: request.amount,
      currency: request.currency,
    };
  }
}

/** 生产实现：真实项目在这里调用支付网关 SDK。 */
@Injectable()
export class ProductionPaymentProvider extends PaymentProvider {
  readonly name = 'production-gateway';

  charge(request: PaymentRequest): PaymentResult {
    return {
      provider: this.name,
      transactionId: 'pay_' + request.orderId,
      amount: request.amount,
      currency: request.currency,
    };
  }
}
