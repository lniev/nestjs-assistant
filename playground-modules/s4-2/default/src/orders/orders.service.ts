import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InMemoryDatabase } from '../database/database';
import { OrderDetailRow } from '../database/entities';

/** 下单入参（真实项目用 class-validator 装饰器的 DTO 做校验）。 */
export interface CreateOrderInput {
  productId?: number;
  userId?: number;
  quantity?: number;
}

/**
 * 练习 s4-2 · 事务、关联与查询性能
 *
 * 三个要点：
 *   1. 事务边界：查库存、扣库存、写订单必须在同一个事务里（真实项目用
 *      dataSource.transaction / prisma.$transaction / queryRunner）；
 *   2. 关联加载：列表用一条 JOIN 查询带上 userName/productName，避免逐行查；
 *   3. 可观测：每次请求前后 mark/ count 查询条数，直接返回在响应里。
 *
 * 可改：把 createOrder 拆成「先查库存（事务外）再开事务扣减」，
 *      然后用 POST /orders/stress 观察并发下会不会超卖 —— 这就是反例演示。
 */
@Injectable()
export class OrdersService {
  constructor(private readonly db: InMemoryDatabase) {}

  private parsePositiveInt(value: unknown, fallback: number, name: string): number {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(name + ' 必须是正整数');
    }
    return parsed;
  }

  /** 下单事务：扣库存 + 写订单，要么全成功，要么回滚。 */
  async createOrder(input: CreateOrderInput = {}) {
    const productId = this.parsePositiveInt(input.productId, 1, 'productId');
    const userId = this.parsePositiveInt(input.userId, 1, 'userId');
    const quantity = this.parsePositiveInt(input.quantity, 1, 'quantity');

    return this.db.transaction(async () => {
      const product = await this.db.productById(productId);
      if (!product) throw new NotFoundException('商品不存在：' + productId);
      if (product.stock < quantity) {
        throw new ConflictException('库存不足：剩余 ' + product.stock + ' 件，需要 ' + quantity + ' 件');
      }
      // 条件更新：真实 SQL 里是 UPDATE ... WHERE stock >= ?，命中 0 行说明被并发抢先
      const affected = await this.db.decrementStock(productId, quantity);
      if (affected === 0) throw new ConflictException('库存扣减失败（并发冲突），请重试');
      return this.db.insertOrder({
        userId,
        productId,
        quantity,
        unitPrice: product.price,
        total: product.price * quantity,
      });
    });
  }

  /** ✅ 分页 + JOIN：SQL 条数固定为 2（COUNT + 一条 JOIN 列表查询），与总行数无关。 */
  async list(pageInput?: string, sizeInput?: string) {
    const page = this.parsePositiveInt(pageInput, 1, 'page');
    const size = Math.min(this.parsePositiveInt(sizeInput, 10, 'size'), 50);
    const mark = this.db.markQueries();
    const total = await this.db.ordersCount();
    const data = await this.db.ordersJoined((page - 1) * size, size);
    return {
      meta: {
        page,
        size,
        total,
        sqlCount: this.db.countSince(mark),
        note: '固定 2 条 SQL：COUNT + JOIN 列表（无 N+1）',
      },
      data,
    };
  }

  /** ❌ N+1 反例：先查列表，再逐行查 user / product，SQL 条数 = 2 + 2N（COUNT + 列表 + 每行 2 条）。 */
  async listNPlusOne(pageInput?: string, sizeInput?: string) {
    const page = this.parsePositiveInt(pageInput, 1, 'page');
    const size = Math.min(this.parsePositiveInt(sizeInput, 10, 'size'), 50);
    const mark = this.db.markQueries();
    const total = await this.db.ordersCount();
    const data = await this.db.ordersNPlusOne((page - 1) * size, size);
    return {
      meta: {
        page,
        size,
        total,
        sqlCount: this.db.countSince(mark),
        note: '2 + 2N 条 SQL：COUNT + 列表 + 每行查用户和商品，行数越多越慢',
      },
      data,
    };
  }

  /** 订单详情：1 条订单 + 1 条用户 + 1 条商品 = 固定 3 条 SQL。 */
  async findById(id: number) {
    const mark = this.db.markQueries();
    const order = await this.db.orderById(id);
    if (!order) throw new NotFoundException('订单不存在：' + id);
    const user = await this.db.userById(order.userId);
    const product = await this.db.productById(order.productId);
    const detail: OrderDetailRow = { ...order, userName: user?.name, productName: product?.name };
    return { meta: { sqlCount: this.db.countSince(mark) }, data: detail };
  }

  /**
   * 并发压力演示：同时下 5 单、每单买 2 件，商品 1 初始库存 5。
   * 期望：成功 2 单、失败 3 单、库存停在 1，永远不为负 —— 靠事务排队 + 条件更新。
   */
  async stressTest() {
    const mark = this.db.markQueries();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => this.createOrder({ productId: 1, userId: 1, quantity: 2 })),
    );
    const succeeded = results.filter((item) => item.status === 'fulfilled').length;
    const failed = results
      .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
      .map((item) => String(item.reason?.message ?? item.reason));
    const product = await this.db.productById(1);
    return {
      meta: { sqlCount: this.db.countSince(mark), note: '互斥事务 + 条件更新保证并发下不超卖' },
      data: { succeeded, failed, product },
    };
  }
}
