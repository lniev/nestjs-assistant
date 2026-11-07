import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  // 练习：取消下面这行注释后重新运行，观察 /health 变成 /api/health
  // app.setGlobalPrefix('api');
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
