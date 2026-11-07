import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common';
import type { ModuleMetadata } from '@nestjs/common/interfaces';

/** 存储模块的运行时配置。 */
export interface StorageModuleOptions {
  bucket: string;
  region?: string;
  maxFiles?: number;
}

/**
 * forRootAsync 的选项：imports / inject / useFactory 与 Nest 内置 async provider 一致。
 * 真实项目用 ConfigurableModuleBuilder 可以自动生成这套样板代码。
 */
export interface StorageModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory: (...args: any[]) => StorageModuleOptions | Promise<StorageModuleOptions>;
}

/** 模块内部令牌：只在模块里使用，用 Symbol 避免与业务令牌撞名。 */
export const STORAGE_OPTIONS = Symbol('STORAGE_OPTIONS');

/**
 * 存储客户端：一个「按 bucket 隔离」的内存对象。
 * 真实项目这里会是 S3 / OSS / MinIO 的 SDK 客户端。
 */
@Injectable()
export class StorageClient {
  private readonly files: string[] = [];

  constructor(
    @Inject(STORAGE_OPTIONS) private readonly options: StorageModuleOptions,
  ) {}

  get bucket(): string {
    return this.options.bucket;
  }

  get region(): string {
    return this.options.region ?? 'local';
  }

  put(name: string) {
    this.files.push(name);
    return { bucket: this.bucket, name };
  }

  list() {
    return {
      bucket: this.bucket,
      region: this.region,
      files: this.files.slice(),
    };
  }
}

/**
 * 动态模块：forRootAsync 在「导入时」接收配置，先把配置对象注册成 provider，
 * 再让 StorageClient 注入它。同一个模块类可以被不同业务模块以不同配置导入，
 * 每个导入方拿到各自独立的模块实例（Nest 会按 DynamicModule 对象区分配置）。
 *
 * 关键点：
 *   - 返回对象必须带 module 属性，否则 Nest 不认；
 *   - useFactory 返回 Promise 也可以，Nest 会等它 resolve 再实例化依赖；
 *   - 真正「应用级唯一」的配置才用 forRoot，模块级多实例用 register/forFeature。
 */
@Module({})
export class StorageModule {
  static forRootAsync(options: StorageModuleAsyncOptions): DynamicModule {
    return {
      module: StorageModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: STORAGE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        StorageClient,
      ],
      exports: [StorageClient],
    };
  }
}
