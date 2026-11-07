import { Injectable } from '@nestjs/common';
import type { DatabaseStats, OrderDetailRow, OrderRow, ProductRow, QueryLogEntry, UserRow } from './entities';

/**
 * 练习 s4-2 · 用内存库模拟「带事务、带查询日志」的数据库
 *
 * 对应 TypeORM 的 DataSource / QueryRunner：transaction(fn) → startTransaction()，
 * SELECT ... FOR UPDATE → 行锁，logging: ['query'] → SQL 日志。
 * 操练场用「内存表 + 全局互斥锁 + 快照回滚」等价表达：并发下单排队执行、失败回滚、
 * 每次「SQL」都记 queryCount 与日志，路由把条数返回给请求台。
 */

type Snapshot = { users: UserRow[]; products: ProductRow[]; orders: OrderRow[]; orderSeq: number };

@Injectable()
export class InMemoryDatabase {
  private users: UserRow[] = [{ id: 1, name: 'Alice' }];
  private products: ProductRow[] = [
    { id: 1, name: '机械键盘', price: 399, stock: 5 },
    { id: 2, name: '显示器', price: 1299, stock: 2 },
  ];
  private orders: OrderRow[] = [
    { id: 1, userId: 1, productId: 1, quantity: 1, unitPrice: 399, total: 399, status: 'paid', createdAt: new Date().toISOString() },
  ];

  private orderSeq = 2;
  private queryCount = 0;
  private readonly queryLog: QueryLogEntry[] = [];
  private lock: Promise<void> = Promise.resolve();
  private txDepth = 0;

  // ---- 查询统计：请求前后各 mark 一次，差值就是这次请求的 SQL 条数 ----
  markQueries(): number {
    return this.queryCount;
  }

  countSince(mark: number): number {
    return this.queryCount - mark;
  }

  /** 模拟一次数据库调用：加 1ms 延迟 + 记录 SQL 与耗时。 */
  private async record<T>(sql: string, params: (string | number)[], executor: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 1));
    const started = Date.now();
    const result = executor();
    this.queryCount += 1;
    this.queryLog.push({ sql, params, ms: Date.now() - started, inTransaction: this.txDepth > 0 });
    if (this.queryLog.length > 40) this.queryLog.shift();
    return result;
  }

  async userById(id: number): Promise<UserRow | null> {
    return this.record('SELECT * FROM users WHERE id = ?', [id], () => this.users.find((row) => row.id === id) ?? null);
  }

  async productById(id: number): Promise<ProductRow | null> {
    return this.record('SELECT * FROM products WHERE id = ?', [id], () => {
      const product = this.products.find((row) => row.id === id);
      return product ? { ...product } : null;
    });
  }

  async productsAll(): Promise<ProductRow[]> {
    return this.record('SELECT * FROM products ORDER BY id', [], () => this.products.map((row) => ({ ...row })));
  }

  /** 条件更新：只有 stock >= quantity 才会命中行，等价于 UPDATE ... WHERE stock >= ?。 */
  async decrementStock(productId: number, quantity: number): Promise<number> {
    return this.record(
      'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      [quantity, productId, quantity],
      () => {
        const product = this.products.find((row) => row.id === productId);
        if (!product || product.stock < quantity) return 0;
        product.stock -= quantity;
        return 1;
      },
    );
  }

  async insertOrder(input: Omit<OrderRow, 'id' | 'status' | 'createdAt'>): Promise<OrderRow> {
    return this.record(
      'INSERT INTO orders (userId, productId, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?)',
      [input.userId, input.productId, input.quantity, input.unitPrice, input.total],
      () => {
        const order: OrderRow = {
          ...input,
          id: this.orderSeq,
          status: 'paid',
          createdAt: new Date().toISOString(),
        };
        this.orderSeq += 1;
        this.orders.push(order);
        return { ...order };
      },
    );
  }

  async ordersCount(): Promise<number> {
    return this.record('SELECT COUNT(*) AS total FROM orders', [], () => this.orders.length);
  }

  async orderById(id: number): Promise<OrderRow | null> {
    return this.record('SELECT * FROM orders WHERE id = ?', [id], () => {
      const order = this.orders.find((row) => row.id === id);
      return order ? { ...order } : null;
    });
  }

  async ordersPage(skip: number, take: number): Promise<OrderRow[]> {
    return this.record('SELECT * FROM orders ORDER BY id DESC LIMIT ? OFFSET ?', [take, skip], () =>
      this.orders
        .slice()
        .sort((left, right) => right.id - left.id)
        .slice(skip, skip + take)
        .map((row) => ({ ...row })),
    );
  }

  /** ✅ 正确的关联加载：一条 JOIN 查询拿全 userName/productName，SQL 条数与行数无关。 */
  async ordersJoined(skip: number, take: number): Promise<OrderDetailRow[]> {
    return this.record(
      'SELECT o.*, u.name AS userName, p.name AS productName FROM orders o ' +
        'JOIN users u ON u.id = o.userId JOIN products p ON p.id = o.productId ' +
        'ORDER BY o.id DESC LIMIT ? OFFSET ?',
      [take, skip],
      () =>
        this.orders
          .slice()
          .sort((left, right) => right.id - left.id)
          .slice(skip, skip + take)
          .map((order) => ({
            ...order,
            userName: this.users.find((user) => user.id === order.userId)?.name,
            productName: this.products.find((product) => product.id === order.productId)?.name,
          })),
    );
  }

  /** ❌ N+1 写法：先查列表，再逐行查用户与商品（COUNT + 列表 + 2N 条：2 + 2N）。 */
  async ordersNPlusOne(skip: number, take: number): Promise<OrderDetailRow[]> {
    const rows = await this.ordersPage(skip, take);
    const details: OrderDetailRow[] = [];
    for (const row of rows) {
      const user = await this.userById(row.userId);
      const product = await this.productById(row.productId);
      details.push({ ...row, userName: user?.name, productName: product?.name });
    }
    return details;
  }

  /**
   * 事务：排队 + 失败回滚。
   * 真实项目里这里换成 queryRunner.startTransaction()，并在 SQL 里用 SELECT ... FOR UPDATE。
   */
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const snapshot: Snapshot = JSON.parse(
      JSON.stringify({ users: this.users, products: this.products, orders: this.orders, orderSeq: this.orderSeq }),
    );
    this.txDepth += 1;
    try {
      return await work();
    } catch (error) {
      // ROLLBACK：恢复事务开始前的快照
      this.users = snapshot.users;
      this.products = snapshot.products;
      this.orders = snapshot.orders;
      this.orderSeq = snapshot.orderSeq;
      throw error;
    } finally {
      this.txDepth -= 1;
      release();
    }
  }

  stats(): DatabaseStats {
    return {
      queryCount: this.queryCount,
      inTransaction: this.txDepth > 0,
      tables: { users: this.users.length, products: this.products.length, orders: this.orders.length },
      lastQueries: this.queryLog.slice(-8),
    };
  }

  resetStats(): void {
    this.queryCount = 0;
    this.queryLog.length = 0;
  }
}
