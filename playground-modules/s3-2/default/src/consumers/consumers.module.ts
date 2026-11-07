import { Controller, Get, Module } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { StorageClient, StorageModule } from '../storage/storage.module';

/**
 * 使用方一：媒体文件模块。
 * 导入 StorageModule.forRootAsync 时用 MEDIA_BUCKET / MEDIA_REGION 配置，
 * 没配置时回落到 media-local / cn-hangzhou。
 */
@Controller('media')
export class MediaController {
  constructor(private readonly storage: StorageClient) {}

  @Get('files')
  files() {
    // owner 只是方便在响应里区分是哪个使用方
    return { owner: 'MediaModule', ...this.storage.list() };
  }
}

@Module({
  imports: [
    StorageModule.forRootAsync({
      inject: [AppConfigService],
      // async 工厂：真实项目里这里可能是「从配置中心 / 密钥服务异步拉取」
      useFactory: async (config: AppConfigService) => ({
        bucket: config.get('MEDIA_BUCKET', 'media-local'),
        region: config.get('MEDIA_REGION', 'cn-hangzhou'),
        maxFiles: config.getNumber('MEDIA_MAX_FILES', 100),
      }),
    }),
  ],
  controllers: [MediaController],
})
export class MediaModule {}

/**
 * 使用方二：备份模块。用另一套 bucket / region，
 * 与 MediaModule 的实例配置互不影响 —— 请求两个接口对比即可。
 */
@Controller('backup')
export class BackupController {
  constructor(private readonly storage: StorageClient) {}

  @Get('files')
  files() {
    return { owner: 'BackupModule', ...this.storage.list() };
  }
}

@Module({
  imports: [
    StorageModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        bucket: config.get('BACKUP_BUCKET', 'backup-archive'),
        region: config.get('BACKUP_REGION', 'cn-beijing'),
      }),
    }),
  ],
  controllers: [BackupController],
})
export class BackupModule {}
