import { forwardRef, Module } from '@nestjs/common';
import { AModule } from '../a/a.module';
import { BService } from './b.service';

/**
 * 练习 s3-4 · 模块层的循环依赖（另一端）
 *
 * BModule 同样用 forwardRef(() => AModule) 反向引用 A 模块。
 * 想彻底去掉这层环，可以把 A、B 共同依赖的东西抽成第三个模块，
 * 或者用事件（@nestjs/event-emitter）替代直接调用。
 */
@Module({
  imports: [forwardRef(() => AModule)],
  providers: [BService],
  exports: [BService],
})
export class BModule {}
