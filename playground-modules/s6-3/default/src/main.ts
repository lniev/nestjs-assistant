import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { traceMiddleware } from './logging/http-observer';
import { JsonLoggerService } from './logging/json-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // 1) traceId 中间件：越早越好，后面的拦截器/控制器/服务都能读到上下文
  app.use(traceMiddleware);

  // 2) 用自定义 JSON Logger 替换 Nest 默认日志（启动日志也变成结构化 JSON）
  app.useLogger(app.get(JsonLoggerService));

  app.enableCors({ origin: true });
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
