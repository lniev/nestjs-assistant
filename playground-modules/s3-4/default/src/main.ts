import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

  // 打开关闭钩子：进程收到 SIGTERM / SIGINT 时 Nest 会依次调用
  // beforeApplicationShutdown → onApplicationShutdown → onModuleDestroy，
  // 这就是「优雅关闭」的入口。没有这一行，停止运行不会触发关闭日志。
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
