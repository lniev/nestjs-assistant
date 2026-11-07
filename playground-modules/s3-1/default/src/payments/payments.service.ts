import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import {
  APP_INFO,
  AppInfo,
  HTTP_CLIENT,
  HttpClientOptions,
  PAYMENT_PROVIDER_ALIAS,
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from './payment.provider';

/**
 * 业务代码只依赖「抽象类令牌 + Symbol/字符串令牌」，完全不知道具体实现是谁：
 * 切换 NODE_ENV 时只需改 AppModule 里的 useClass，本文件零改动。
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly config: AppConfigService,
    // 抽象类令牌：构造参数类型就是注入令牌
    private readonly paymentProvider: PaymentProvider,
    // useExisting 起出来的别名：和 paymentProvider 指向同一个实例
    @Inject(PAYMENT_PROVIDER_ALIAS) private readonly aliasedProvider: PaymentProvider,
    // useFactory 产出的配置对象（Symbol 令牌）
    @Inject(HTTP_CLIENT) private readonly httpClient: HttpClientOptions,
    // useValue 注入的常量对象（字符串令牌）
    @Inject(APP_INFO) private readonly appInfo: AppInfo,
  ) {}

  describe() {
    return {
      environment: this.config.environment,
      appInfo: this.appInfo,
      provider: this.paymentProvider.name,
      httpClient: this.httpClient,
      aliasPointsToSameInstance: this.aliasedProvider === this.paymentProvider,
      hint: '把 config.service.ts 里 PAYMENT_MODE 的默认值改成 production，provider 会变成 production-gateway',
    };
  }

  charge(request: PaymentRequest): PaymentResult {
    return this.paymentProvider.charge(request);
  }
}
