import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CATS_REPOSITORY,
  Cat,
  CatsRepositoryPort,
  CatsService,
  InMemoryCatsRepository,
} from '../cats/cats.service';
import { TestBed, expect } from './test-bed';

/**
 * CatsService 单测套件（不依赖 jest）。
 *
 * 与真实 jest 文件一比一对应：
 *
 *   describe('CatsService', () => {
 *     let service: CatsService;
 *     let fakeRepo: FakeCatsRepository;
 *     beforeEach(async () => {
 *       const moduleRef = await Test.createTestingModule({
 *         providers: [CatsService, { provide: CATS_REPOSITORY, useClass: InMemoryCatsRepository }],
 *       }).overrideProvider(CATS_REPOSITORY).useValue(new FakeCatsRepository()).compile();
 *       service = moduleRef.get(CatsService);
 *     });
 *     it('findOne 找不到抛 NotFoundException', () => { ... });
 *   });
 *
 * 这里把每个用例写成「新建 TestingModule -> overrideProvider -> 断言」，
 * GET /test/run 会依次执行并返回结果，效果等价于 npm test 的控制台输出。
 */

export interface SpecResult {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}

interface FakeRepository extends CatsRepositoryPort {
  findCalls: number;
  saveCalls: number;
}

/** 手写 mock 仓储：记录调用次数，验证 service 真的走的是注入的仓储。 */
function createFakeRepository(seed: Cat[]): FakeRepository {
  const cats = seed.map((cat) => ({ ...cat }));
  let nextId = cats.length + 1;
  const fake: FakeRepository = {
    findCalls: 0,
    saveCalls: 0,
    findAll(): Cat[] {
      fake.findCalls += 1;
      return cats;
    },
    findById(id: number): Cat | undefined {
      fake.findCalls += 1;
      return cats.find((cat) => cat.id === id);
    },
    save(cat: Omit<Cat, 'id'>): Cat {
      fake.saveCalls += 1;
      const created: Cat = { id: nextId, ...cat };
      nextId += 1;
      cats.push(created);
      return created;
    },
  };
  return fake;
}

/** 复用同一套「编译测试模块」的样板代码，等价 jest 的 beforeEach。 */
async function withService(
  seed: Cat[],
  run: (service: CatsService, fake: FakeRepository) => Promise<void> | void,
): Promise<void> {
  const fake = createFakeRepository(seed);
  const moduleRef = await TestBed.createTestingModule({
    providers: [CatsService, { provide: CATS_REPOSITORY, useClass: InMemoryCatsRepository }],
  })
    .overrideProvider(CATS_REPOSITORY)
    .useValue(fake)
    .compile();
  try {
    const service = moduleRef.get<CatsService>(CatsService);
    await run(service, fake);
  } finally {
    await moduleRef.close();
  }
}

export async function runCatsSpec(): Promise<{ results: SpecResult[]; passed: number; failed: number }> {
  const cases: { name: string; run: () => Promise<void> }[] = [
    {
      name: 'findAll 走 mock 仓储，返回 fake 里的数据',
      run: async () => {
        await withService(
          [
            { id: 1, name: 'Tom', age: 3 },
            { id: 2, name: 'Jerry', age: 2 },
          ],
          (service, fake) => {
            const cats = service.findAll();
            expect(cats.length).toBe(2);
            expect(cats[0].name).toBe('Tom');
            expect(fake.findCalls).toBe(1);
          },
        );
      },
    },
    {
      name: 'findOne 找不到时抛 NotFoundException（404）',
      run: async () => {
        await withService([], (service) => {
          expect(() => service.findOne(999)).toThrow(NotFoundException);
          try {
            service.findOne(999);
          } catch (error) {
            const status = typeof error?.getStatus === 'function' ? error.getStatus() : 0;
            expect(status).toBe(404);
            return;
          }
          throw new Error('应该抛出 NotFoundException');
        });
      },
    },
    {
      name: 'create 拒绝空 name（400），且不落库',
      run: async () => {
        await withService([], (service, fake) => {
          expect(() => service.create({ name: '   ' })).toThrow(BadRequestException);
          expect(fake.saveCalls).toBe(0);
        });
      },
    },
    {
      name: 'create 正常写入并返回自增 id',
      run: async () => {
        await withService([{ id: 1, name: 'Tom', age: 3 }], (service, fake) => {
          const created = service.create({ name: 'Milo', age: 1 });
          expect(created.id).toBe(2);
          expect(created.name).toBe('Milo');
          expect(fake.saveCalls).toBe(1);
        });
      },
    },
  ];

  const results: SpecResult[] = [];
  for (const item of cases) {
    const started = Date.now();
    try {
      await item.run();
      results.push({ name: item.name, ok: true, detail: '通过', ms: Date.now() - started });
    } catch (error) {
      results.push({ name: item.name, ok: false, detail: String(error?.message ?? error), ms: Date.now() - started });
    }
  }
  const failed = results.filter((item) => !item.ok).length;
  return { results, passed: results.length - failed, failed };
}
