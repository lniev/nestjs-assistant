import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SECURITY_CONFIG, isOriginAllowed, originGuard, securityHeaders } from './security/security';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // 用 any 是为了在未安装 @types/express 的操练场里调用 express 实例的方法。
  const instance: any = app.getHttpAdapter().getInstance();
  instance.disable('x-powered-by');
  instance.set('trust proxy', true);

  // 1) 安全响应头（helmet 等价物）
  app.use(securityHeaders);
  // 2) 非白名单 Origin 直接 403（比浏览器端 CORS 报错更早、更明确）
  app.use(originGuard);

  // 3) 真正的 CORS 头：只对白名单回 Access-Control-Allow-Origin
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: any) => void) => {
      if (isOriginAllowed(origin)) {
        // 回显具体 Origin（不能用 *），这样 credentials: true 才合法
        callback(null, origin ?? true);
      } else {
        callback(new Error('Origin 不在白名单：' + origin));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['Retry-After', 'X-Trace-Id'],
    maxAge: 600,
  });

  // 允许的 Origin 列表来自配置，改白名单只改 SECURITY_CONFIG.corsAllowlist
  void SECURITY_CONFIG;
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
