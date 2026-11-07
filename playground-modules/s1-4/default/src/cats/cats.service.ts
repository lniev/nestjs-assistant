import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '../shared/logger.module';

export interface Cat {
  id: number;
  name: string;
  age: number;
}

export interface CreateCatDto {
  name: string;
  age?: number;
}

/**
 * 业务服务：依赖注入 LoggerService，但 LoggerService 来自另一个模块。
 *
 * 注意构造函数注入：Nest 会读取 emitDecoratorMetadata 生成的类型元数据，
 * 按类型找到 CatsModule.imports 里 LoggerModule 导出的同一实例。
 */
@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [
    { id: 1, name: 'Tom', age: 3 },
    { id: 2, name: 'Jerry', age: 2 },
  ];

  private nextId = 3;

  constructor(private readonly logger: LoggerService) {
    this.logger.log('CatsService 已创建（单例，生命周期跟随应用）');
  }

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: number): Cat {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException('id 必须是正整数');
    }
    const cat = this.cats.find((item) => item.id === numeric);
    if (!cat) throw new NotFoundException('猫咪 #' + id + ' 不存在');
    return cat;
  }

  create(dto: CreateCatDto): Cat {
    if (dto === null || typeof dto.name !== 'string' || dto.name.trim() === '') {
      throw new BadRequestException('name 必填且不能为空');
    }
    const age = dto.age === undefined ? 0 : Number(dto.age);
    if (!Number.isFinite(age) || age < 0) throw new BadRequestException('age 必须是非负数字');
    const cat: Cat = { id: this.nextId, name: dto.name.trim(), age };
    this.nextId += 1;
    this.cats.push(cat);
    this.logger.log('创建猫咪 #' + cat.id + ' ' + cat.name);
    return cat;
  }
}
