import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

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
 * 抽象：控制器只依赖这个接口，不关心数据从哪来。
 *
 * 真实项目会换成 `interface CatsRepository { findAll(): Promise<Cat[]> ... }`
 * 并在基础设施层用 TypeORM/Prisma 实现。
 */
export interface CatsRepository {
  findAll(): Cat[];
  findOne(id: number): Cat;
  create(dto: CreateCatDto): Cat;
  remove(id: number): Cat;
}

/**
 * 注入令牌：接口在运行时会被擦除，所以用字符串常量当 token。
 * 也可以用 Symbol，效果相同。
 */
export const CATS_REPOSITORY = 'CATS_REPOSITORY';

/**
 * 内存实现：@Injectable() 让 Nest 可以把它当 provider 创建。
 * 换成 useClass: MySqlCatsRepository 即可替换实现，控制器零改动。
 */
@Injectable()
export class InMemoryCatsRepository implements CatsRepository {
  private readonly cats: Cat[] = [
    { id: 1, name: 'Tom', age: 3 },
    { id: 2, name: 'Jerry', age: 2 },
  ];

  private nextId = 3;

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
    return cat;
  }

  remove(id: number): Cat {
    const cat = this.findOne(id);
    this.cats.splice(this.cats.indexOf(cat), 1);
    return cat;
  }
}
