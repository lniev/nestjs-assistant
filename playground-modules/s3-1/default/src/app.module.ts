import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppConfigService, PAYMENT_MODE } from './config/config.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import {
  APP_INFO,
  HTTP_CLIENT,
  PAYMENT_PROVIDER_ALIAS,
  PaymentProvider,
  ProductionPaymentProvider,
  SandboxPaymentProvider,
} from './payments/payment.provider';

/**
 * 练习 s3-1 · 自定义 Provider 与注入令牌
 *
 * 四类自定义 provider 都在这一个模块里：
 *   ① useValue   —— 注入常量对象（应用元信息）
 *   ② useClass   —— 按运行环境把「抽象类令牌」绑定到不同实现，业务代码零改动
 *   ③ useFactory —— 先注入依赖再动态创建 provider（带超时的 HTTP 客户端配置）
 *   ④ useExisting—— 给已注册的 provider 起别名，两个令牌指向同一实例
 *
 * 令牌形式也覆盖了三种：抽象类（PaymentProvider）、Symbol（HTTP_CLIENT）、
 * 字符串（APP_INFO、PAYMENT_PROVIDER_ALIAS）。
 *
 * 建议动手：
 *   1. 把 config/config.service.ts 里 PAYMENT_MODE 三目表达式中的 'sandbox' 改成 'production'，
 *      重新运行后访问 /payments/config，看 provider 从 sandbox-stub 变成 production-gateway
 *      （真实部署则直接设置 NODE_ENV=production）；
 *   2. 把 useClass 改成 useFactory，用工厂函数返回实现实例；
 *   3. 删掉 useExisting 那一行，观察 /payments/config 的 aliasPointsToSameInstance。
 */
@Module({
  controllers: [AppController, PaymentsController],
  providers: [
    AppConfigService,
    // ① useValue：注入常量 / 外部对象
    {
      provide: APP_INFO,
      useValue: { name: 'nest-playground', version: '1.0.0' },
    },
    // ② useClass：按运行环境选择实现，业务代码只依赖抽象类令牌 PaymentProvider
    //    PAYMENT_MODE 的定义与「怎么在这里切换」见 config/config.service.ts
    {
      provide: PaymentProvider,
      useClass:
        PAYMENT_MODE === 'production'
          ? ProductionPaymentProvider
          : SandboxPaymentProvider,
    },
    // ③ useFactory：工厂可以先注入其它 provider；真实项目常用来创建带超时/重试的 HTTP 客户端。
    //    useFactory 返回 Promise 也可以（async provider），Nest 会等它 resolve 再注入。
    {
      provide: HTTP_CLIENT,
      useFactory: async (config: AppConfigService) => ({
        baseUrl: config.get('PAYMENT_BASE_URL', 'https://sandbox.pay.example'),
        timeoutMs: config.getNumber('PAYMENT_TIMEOUT_MS', 3000),
        retries: 2,
      }),
      inject: [AppConfigService],
    },
    // ④ useExisting：别名 provider，不新建实例
    { provide: PAYMENT_PROVIDER_ALIAS, useExisting: PaymentProvider },
    PaymentsService,
  ],
})
export class AppModule {}
