import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCatDto } from './dto';

export interface Cat {
  id: number;
  name: string;
  age: number;
}

/** 内存数据源：进入控制器的数据一定是校验过的 DTO，所以这里只做业务判断。 */
@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [
    { id: 1, name: 'Tom', age: 3 },
    { id: 2, name: 'Jerry', age: 2 },
  ];

  private nextId = 3;

  findAll(name?: string, limit = 20): Cat[] {
    const filtered =
      name === undefined ? this.cats : this.cats.filter((cat) => cat.name.toLowerCase() === name.toLowerCase());
    return filtered.slice(0, limit);
  }

  findOne(id: number): Cat {
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('id 必须是正整数');
    const cat = this.cats.find((item) => item.id === id);
    if (!cat) throw new NotFoundException('猫咪 #' + id + ' 不存在');
    return cat;
  }

  create(dto: CreateCatDto): Cat {
    const cat: Cat = { id: this.nextId, name: dto.name, age: dto.age };
    this.nextId += 1;
    this.cats.push(cat);
    return cat;
  }
}
