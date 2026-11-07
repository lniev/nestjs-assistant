import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

/**
 * 手写版全局 ValidationPipe。
 *
 * 真实项目直接来自 @nestjs/common：
 *   app.useGlobalPipes(new ValidationPipe({
 *     whitelist: true,            // 剥离 DTO 上没声明的字段
 *     forbidNonWhitelisted: true, // 或者：出现多余字段直接 400
 *     transform: true,            // 转成 DTO 类实例、做类型转换
 *   }));
 *
 * 本插件没装 class-validator / class-transformer，这里用「DTO 上的静态 parse()」
 * 做等价表达：读 metatype → 调用它的 parse 完成校验/转换/白名单。
 *
 * 管道对 @Body / @Query / @Param 都生效；metatype 就是参数声明的类型。
 */
@Injectable()
export class ValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype as { parse?: (input: unknown) => unknown } | undefined;
    if (metatype === undefined || metatype === null) return value;
    if (typeof metatype.parse !== 'function') return value;
    return metatype.parse(value);
  }
}
