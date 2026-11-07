import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

/**
 * 手写的「测试模块」——等价于 @nestjs/testing 的最小可用子集。
 *
 * 真实项目（npm i -D @nestjs/testing jest ts-jest @types/jest）：
 *
 *   const moduleRef = await Test.createTestingModule({
 *     providers: [CatsService, { provide: CATS_REPOSITORY, useClass: InMemoryCatsRepository }],
 *   })
 *     .overrideProvider(CATS_REPOSITORY)
 *     .useValue(fakeRepository)
 *     .compile();
 *   const service = moduleRef.get(CatsService);
 *
 * 操练场没装这些包，但 Nest 自带 DI 容器，所以这里用
 * NestFactory.createApplicationContext 建一个「不监听端口」的应用上下文，
 * 复刻同样的四步 API：createTestingModule -> overrideProvider -> compile -> get。
 * 好处：测试真的走 Nest DI，而不是手工 new，能验证注入令牌/作用域是否正确。
 */

@Module({})
class TestRootModule {}

export interface TestingModuleOptions {
  providers?: any[];
}

class OverrideBy {
  constructor(
    private readonly token: any,
    private readonly builder: TestingModuleBuilder,
  ) {}

  /** 等价 overrideProvider(X).useValue(mock)。 */
  useValue(value: any): TestingModuleBuilder {
    this.builder.setOverride(this.token, { provide: this.token, useValue: value });
    return this.builder;
  }
}

function providerToken(provider: any): any {
  if (typeof provider === 'function') return provider;
  if (provider && typeof provider === 'object' && 'provide' in provider) return provider.provide;
  return provider;
}

export class TestingModuleBuilder {
  private readonly overrides = new Map<any, any>();
  private readonly providers: any[];

  constructor(providers: any[]) {
    this.providers = providers;
  }

  overrideProvider(token: any): OverrideBy {
    return new OverrideBy(token, this);
  }

  setOverride(token: any, override: any): void {
    this.overrides.set(token, override);
  }

  /** 真实项目 compile() 之后同样返回 TestingModule（含 get / close）。 */
  async compile(): Promise<TestingModule> {
    const providers = this.providers.map((provider) => {
      const token = providerToken(provider);
      return this.overrides.get(token) ?? provider;
    });
    const app = await NestFactory.createApplicationContext({ module: TestRootModule, providers }, {
      logger: false,
    });
    return new TestingModule(app);
  }
}

export class TestingModule {
  constructor(private readonly app: any) {}

  get<T = any>(token: any): T {
    return this.app.get(token);
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}

export class TestBed {
  static createTestingModule(options?: TestingModuleOptions): TestingModuleBuilder {
    const providers = options?.providers ?? [];
    return new TestingModuleBuilder(providers);
  }
}

/**
 * 极小断言器（jest expect 的等价物），让单测读起来和真实项目一致。
 * 真实项目直接用 jest 的 expect；这里只实现本练习用到的三个匹配器。
 */
export function expect(actual: any) {
  return {
    toBe(expected: any): void {
      if (actual !== expected) {
        throw new Error('期望 ' + String(expected) + '，实际 ' + String(actual));
      }
    },
    toEqual(expected: any): void {
      const left = JSON.stringify(actual);
      const right = JSON.stringify(expected);
      if (left !== right) throw new Error('期望 ' + right + '，实际 ' + left);
    },
    toThrow(errorType?: any): void {
      if (typeof actual !== 'function') throw new Error('toThrow 需要一个函数');
      try {
        actual();
      } catch (error) {
        if (errorType && !(error instanceof errorType) && error?.constructor !== errorType) {
          throw new Error('期望抛出 ' + errorType.name + '，实际 ' + String(error?.constructor?.name));
        }
        return;
      }
      throw new Error('期望抛出异常，但没有抛');
    },
  };
}
