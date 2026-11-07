import { Injectable } from '@nestjs/common';
import { ORDERS_TABLE, TableDef, USERS_TABLE } from './entities';

/** 查询条件：真实项目里由 TypeORM 的 FindOptions / Prisma 的 where 提供。 */
export interface QueryOptions {
  where?: (row: Record<string, any>) => boolean;
  orderBy?: string;
  direction?: 'asc' | 'desc';
  skip?: number;
  take?: number;
}

/**
 * 练习 s4-1 · 用内存库模拟 DataSource
 *
 * 它扮演 TypeORM DataSource / Prisma Client 的角色：
 *   - runMigrations()：建表 + 种子数据，相当于 `migration:run`；
 *   - insert/find/findOne/update/delete/count：仓储层实际调用的底层能力。
 *
 * 真实项目里连接配置由 ConfigService 注入（forRootAsync），
 * 生产环境用迁移而不是 synchronize；操练场为了「开箱即跑」用内存表。
 */
@Injectable()
export class InMemoryDatabase {
  private readonly schemas = new Map<string, TableDef>();
  private readonly rows = new Map<string, Record<string, any>[]>();
  private readonly sequences = new Map<string, number>();
  private migrated = false;

  /** 建表 + 种子；重复调用是幂等的（等价于迁移只跑一次）。 */
  async runMigrations(): Promise<{ applied: string[]; tables: string[] }> {
    const applied: string[] = [];
    for (const table of [USERS_TABLE, ORDERS_TABLE]) {
      if (this.schemas.has(table.name)) continue;
      this.schemas.set(table.name, table);
      this.rows.set(table.name, []);
      this.sequences.set(table.name, 1);
      applied.push('001-init/up：create table ' + table.name);
    }
    if (applied.length > 0) this.seed();
    this.migrated = true;
    return { applied, tables: this.tableNames() };
  }

  private seed(): void {
    // 真实项目中种子数据放在 seed 脚本或测试 fixture 里，不放进迁移。
    this.rows.get('users')!.push(
      { id: 1, email: 'alice@example.com', name: 'Alice', createdAt: new Date().toISOString() },
      { id: 2, email: 'bob@example.com', name: 'Bob', createdAt: new Date().toISOString() },
    );
    this.sequences.set('users', 3);
    this.rows.get('orders')!.push(
      {
        id: 1,
        userId: 1,
        productName: '机械键盘',
        amount: 399,
        status: 'paid',
        createdAt: new Date().toISOString(),
      },
    );
    this.sequences.set('orders', 2);
  }

  private table(name: string): Record<string, any>[] {
    const table = this.rows.get(name);
    if (!table) throw new Error('未迁移的表：' + name + '（先执行 runMigrations）');
    return table;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  async insert<T extends { id: number }>(table: string, row: Omit<T, 'id'>): Promise<T> {
    const id = this.sequences.get(table) ?? 1;
    this.sequences.set(table, id + 1);
    const entity = { ...row, id } as unknown as T;
    this.table(table).push(this.clone(entity as any));
    return this.clone(entity);
  }

  async find<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
    let list = this.clone(this.table(table));
    if (options.where) list = list.filter(options.where);
    if (options.orderBy) {
      const key = options.orderBy;
      const factor = options.direction === 'desc' ? -1 : 1;
      list.sort((left, right) => (left[key] > right[key] ? factor : left[key] < right[key] ? -factor : 0));
    }
    const start = options.skip ?? 0;
    const end = options.take === undefined ? list.length : start + options.take;
    return list.slice(start, end) as T[];
  }

  async findOne<T>(table: string, options: QueryOptions): Promise<T | null> {
    const found = await this.find<T>(table, { ...options, take: 1 });
    return found.length > 0 ? found[0] : null;
  }

  async findById<T extends { id: number }>(table: string, id: number): Promise<T | null> {
    return this.findOne<T>(table, { where: (row) => row.id === id });
  }

  async update<T extends { id: number }>(table: string, id: number, patch: Partial<T>): Promise<T | null> {
    const row = this.table(table).find((item) => item.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return this.clone(row) as T;
  }

  async delete(table: string, id: number): Promise<boolean> {
    const rows = this.table(table);
    const index = rows.findIndex((item) => item.id === id);
    if (index < 0) return false;
    rows.splice(index, 1);
    return true;
  }

  async count(table: string): Promise<number> {
    return this.table(table).length;
  }

  tableNames(): string[] {
    return [...this.schemas.keys()];
  }

  /** 给 /health、/migrate 路由展示表结构与列（等价于 `SHOW COLUMNS`）。 */
  describe(): { table: string; columns: { name: string; type: string }[] }[] {
    return [...this.schemas.values()].map((table) => ({
      table: table.name,
      columns: table.columns.map((column) => ({ name: column.name, type: column.type })),
    }));
  }

  isMigrated(): boolean {
    return this.migrated;
  }
}
