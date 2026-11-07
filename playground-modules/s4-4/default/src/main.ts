import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

  // 真实项目如果你把拦截器全局注册，这里也可以放全局管道/过滤器：
  //   app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
