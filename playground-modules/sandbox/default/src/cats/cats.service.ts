import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

/** A cat stored by the sample application. */
export interface Cat {
  id: number;
  name: string;
  age: number;
}

/** Payload accepted by `POST /cats`. */
export interface CreateCatDto {
  name: string;
  age?: number;
}

/**
 * In-memory data store used by the sample `CatsController`.
 *
 * The array lives for as long as the Nest process is running, so restarting
 * the playground resets it. Replace it with a real repository/database client
 * to experiment with persistence.
 */
@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [
    { id: 1, name: 'Tom', age: 3 },
    { id: 2, name: 'Jerry', age: 2 },
  ];

  private nextId = 3;

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: number): Cat {
    const cat = this.cats.find((item) => item.id === id);
    if (!cat) {
      throw new NotFoundException('Cat #' + id + ' not found');
    }
    return cat;
  }

  create(dto: CreateCatDto): Cat {
    if (!dto || typeof dto.name !== 'string' || dto.name.trim() === '') {
      throw new BadRequestException('name must be a non-empty string');
    }
    const age = dto.age === undefined ? 0 : Number(dto.age);
    if (!Number.isFinite(age) || age < 0) {
      throw new BadRequestException('age must be a non-negative number');
    }
    const cat: Cat = { id: this.nextId, name: dto.name.trim(), age };
    this.nextId += 1;
    this.cats.push(cat);
    return cat;
  }
}
