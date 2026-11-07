import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

/**
 * 练习 s6-1 · 单元测试与测试模块
 *
 * 核心思路：CatsService 只依赖「仓储接口」，不关心背后是数据库还是 mock。
 * 这让单测可以用 overrideProvider 注入一个 fake 仓储，完全脱离数据库。
 *
 * 真实项目：
 *   @InjectRepository(Cat) private readonly repo: Repository<Cat>
 *   单测：
 *     const moduleRef = await Test.createTestingModule({ providers: [CatsService] })
 *       .overrideProvider(getRepositoryToken(Cat))
 *       .useValue({ find: jest.fn().mockResolvedValue([]) })
 *       .compile();
 *
 * 操练场没装 @nestjs/testing 与 jest，所以：
 *   - 依赖令牌用 Symbol 表达（等价 getRepositoryToken(Cat)）；
 *   - testing/ 目录手写 TestBed 复刻同样的 API 形状，见 test-bed.ts 注释。
 */
export interface Cat {
  id: number;
  name: string;
  age: number;
}

export interface CreateCatDto {
  name?: string;
  age?: number;
}

/** 仓储端口：service 只认这个接口，测试时可以换成任何实现。 */
export interface CatsRepositoryPort {
  findAll(): Cat[];
  findById(id: number): Cat | undefined;
  save(cat: Omit<Cat, 'id'>): Cat;
}

/** 注入令牌。真实项目：getRepositoryToken(Cat) 或 CATS_REPOSITORY 常量。 */
export const CATS_REPOSITORY = Symbol('CATS_REPOSITORY');

/** 生产实现：内存仓储（真实项目换成 TypeORM/Prisma 实现）。 */
@Injectable()
export class InMemoryCatsRepository implements CatsRepositoryPort {
  private readonly cats: Cat[] = [
    { id: 1, name: 'Tom', age: 3 },
    { id: 2, name: 'Jerry', age: 2 },
  ];
  private nextId = 3;

  findAll(): Cat[] {
    return this.cats;
  }

  findById(id: number): Cat | undefined {
    return this.cats.find((cat) => cat.id === id);
  }

  save(cat: Omit<Cat, 'id'>): Cat {
    const created: Cat = { id: this.nextId, ...cat };
    this.nextId += 1;
    this.cats.push(created);
    return created;
  }
}

@Injectable()
export class CatsService {
  constructor(
    @Inject(CATS_REPOSITORY)
    private readonly repository: CatsRepositoryPort,
  ) {}

  findAll(): Cat[] {
    return this.repository.findAll();
  }

  findOne(id: number): Cat {
    const cat = this.repository.findById(id);
    if (!cat) {
      throw new NotFoundException({ code: 'CAT_NOT_FOUND', message: 'Cat #' + id + ' 不存在' });
    }
    return cat;
  }

  create(dto: CreateCatDto): Cat {
    const name = typeof dto?.name === 'string' ? dto.name.trim() : '';
    if (name === '') {
      throw new BadRequestException({ code: 'CAT_NAME_REQUIRED', message: 'name 必须是非空字符串' });
    }
    const age = dto?.age === undefined ? 0 : Number(dto.age);
    if (!Number.isFinite(age) || age < 0) {
      throw new BadRequestException({ code: 'CAT_AGE_INVALID', message: 'age 必须是非负数' });
    }
    return this.repository.save({ name, age });
  }
}
