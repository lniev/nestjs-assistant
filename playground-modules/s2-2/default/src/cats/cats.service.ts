import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

export interface Cat {
  id: number;
  name: string;
  age: number;
}

/** 内存数据源：删除是破坏性操作，所以只允许 admin。 */
@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [
    { id: 1, name: 'Tom', age: 3 },
    { id: 2, name: 'Jerry', age: 2 },
  ];

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: number): Cat {
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('id 必须是正整数');
    const cat = this.cats.find((item) => item.id === id);
    if (!cat) throw new NotFoundException('猫咪 #' + id + ' 不存在');
    return cat;
  }

  remove(id: number): Cat {
    const cat = this.findOne(id);
    this.cats.splice(this.cats.indexOf(cat), 1);
    return cat;
  }
}
