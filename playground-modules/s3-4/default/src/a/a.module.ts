import { forwardRef, Module } from '@nestjs/common';
import { BModule } from '../b/b.module';
import { AService } from './a.service';

/**
 * 练习 s3-4 · 模块层的循环依赖
 *
 * AModule 需要 BModule 导出的 BService，BModule 又需要 AService。
 * 两个模块文件互相 import 时，运行到其中一个模块时另一个模块的 class 还不存在，
 * 所以 imports 里必须写成 forwardRef(() => BModule) 让 Nest 延后解析。
 * 只写 forwardRef 不够：另一侧 BModule 也要 forwardRef(() => AModule)。
 */
@Module({
  imports: [forwardRef(() => BModule)],
  providers: [AService],
  exports: [AService],
})
export class AModule {}
