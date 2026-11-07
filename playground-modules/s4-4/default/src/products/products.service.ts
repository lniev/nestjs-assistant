import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

/** 商品模型（真实项目里是 TypeORM 实体）。 */
export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export interface ProductDetail extends Product {
  queryMs: number;
  fetchedAt: string;
}

/**
 * 练习 s4-4 · 商品服务：故意让读接口「很慢」
 *
 * 每次查询都模拟 220ms 的数据库/下游耗时，这样缓存的效果非常直观：
 * 第二次 GET /products/:id 命中缓存后不会有这 220ms，fetchedAt 也保持第一次的值。
 *
 * 真实项目里慢查询可能来自：缺索引、N+1、跨服务调用、复杂聚合。
 * 缓存是止血手段，先确认 SQL 已经优化，再决定缓存什么。
 */
@Injectable()
export class ProductsService {
  private readonly products: Product[] = [
    { id: 1, name: '机械键盘', price: 399, stock: 5 },
    { id: 2, name: '显示器', price: 1299, stock: 2 },
  ];

  private nextId = 3;

  async findAll() {
    const started = Date.now();
    await this.simulateSlowQuery();
    return {
      data: this.products.map((product) => ({ ...product })),
      queryMs: Date.now() - started,
      fetchedAt: new Date().toISOString(),
      hint: '列表缓存 2 秒；更新商品会主动清掉 http:/products 前缀的所有缓存',
    };
  }

  async findById(id: number): Promise<ProductDetail> {
    const started = Date.now();
    await this.simulateSlowQuery();
    const product = this.products.find((item) => item.id === id);
    if (!product) throw new NotFoundException('商品不存在：' + id);
    return {
      ...product,
      queryMs: Date.now() - started,
      fetchedAt: new Date().toISOString(),
      // fetchedAt 相同 = 命中了缓存；不同 = 重新查了「数据库」
    };
  }

  async update(id: number, patch: { name?: string; price?: number; stock?: number }): Promise<Product> {
    const product = this.products.find((item) => item.id === id);
    if (!product) throw new NotFoundException('商品不存在：' + id);
    if (patch?.name !== undefined) {
      const name = String(patch.name).trim();
      if (name === '') throw new BadRequestException('name 不能为空');
      product.name = name;
    }
    if (patch?.price !== undefined) {
      const price = Number(patch.price);
      if (!Number.isFinite(price) || price < 0) throw new BadRequestException('price 必须是非负数');
      product.price = price;
    }
    if (patch?.stock !== undefined) {
      const stock = Number(patch.stock);
      if (!Number.isInteger(stock) || stock < 0) throw new BadRequestException('stock 必须是非负整数');
      product.stock = stock;
    }
    return { ...product };
  }

  async create(input: { name?: string; price?: number; stock?: number }): Promise<Product> {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const price = Number(input?.price ?? 0);
    if (name === '') throw new BadRequestException('name 不能为空');
    const product: Product = {
      id: this.nextId,
      name,
      price,
      stock: Number.isInteger(input?.stock) ? Number(input?.stock) : 0,
    };
    this.nextId += 1;
    this.products.push(product);
    return { ...product };
  }

  /** 模拟一次慢查询（真实项目：数据库/HTTP 下游）。 */
  private simulateSlowQuery(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 220));
  }
}
