import { BadRequestException } from '@nestjs/common';

/**
 * DTO：把请求体形状 + 校验规则写在同一个类里。
 *
 * 真实项目（class-validator）写法：
 *   export class CreateCatDto {
 *     @IsString() @IsNotEmpty() name!: string;
 *     @IsOptional() @IsInt() @Min(0) age?: number;
 *   }
 *
 * 这里用静态 parse() 手写等价逻辑：
 *   1. 缺字段/类型不对 → 400，并返回可读的错误列表；
 *   2. 数字字符串会被转换成 number（等价于 @Type(() => Number)）；
 *   3. 未声明的字段被剥离（等价于 ValidationPipe({ whitelist: true })）。
 */
export class CreateCatDto {
  name: string;
  age: number;

  static parse(input: unknown): CreateCatDto {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException(['请求体必须是 JSON 对象']);
    }
    const body = input as Record<string, unknown>;
    const errors: string[] = [];

    if (typeof body.name !== 'string' || body.name.trim() === '') {
      errors.push('name 必填，且必须是非空字符串');
    }

    let age = 0;
    if (body.age !== undefined) {
      age = Number(body.age);
      if (!Number.isInteger(age) || age < 0) errors.push('age 必须是 >= 0 的整数');
    }

    if (errors.length > 0) throw new BadRequestException(errors);

    // 白名单：只拷贝声明过的字段
    const dto = new CreateCatDto();
    dto.name = String(body.name).trim();
    dto.age = age;
    return dto;
  }
}

/**
 * 查询参数 DTO：证明管道同样作用于 @Query()。
 *
 * 真实项目用 @Query() 配合 @IsOptional() @IsInt() @Type(() => Number)。
 */
export class ListCatsQuery {
  name?: string;
  limit: number;

  static parse(input: unknown): ListCatsQuery {
    const query = (input !== null && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const errors: string[] = [];

    let name: string | undefined;
    if (query.name !== undefined) {
      if (typeof query.name !== 'string') errors.push('name 必须是字符串');
      else name = query.name;
    }

    let limit = 20;
    if (query.limit !== undefined) {
      limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.push('limit 必须是 1-100 的整数');
    }

    if (errors.length > 0) throw new BadRequestException(errors);

    const dto = new ListCatsQuery();
    dto.name = name;
    dto.limit = limit;
    return dto;
  }
}
