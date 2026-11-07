import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppConfigModule } from './config/config.service';
import { BackupModule, MediaModule } from './consumers/consumers.module';

/**
 * 练习 s3-2 · 动态模块与异步配置
 *
 * 两个业务模块各自用不同配置导入「同一个」StorageModule.forRootAsync：
 *   - MediaModule  → bucket: media-local（可被 MEDIA_BUCKET 覆盖）
 *   - BackupModule → bucket: backup-archive（可被 BACKUP_BUCKET 覆盖）
 * 请求 /media/files 与 /backup/files 会看到不同 bucket —— 说明实例配置互不串。
 *
 * 建议动手：
 *   1. 把 MediaModule 的 useFactory 改成同步返回（去掉 async），对比行为；
 *   2. 给 StorageModule 加一个 register(options) 同步版本，理解 register 与 forRoot 的语义差异；
 *   3. 把 STORAGE_OPTIONS 从 Symbol 改成字符串令牌，再给 useFactory 的 inject 加一个可选依赖。
 */
@Module({
  imports: [AppConfigModule, MediaModule, BackupModule],
  controllers: [AppController],
})
export class AppModule {}
