/**
 * 练习 s4-2 · 数据模型与查询日志类型
 *
 * 真实项目里这些 interface 会写成 TypeORM 实体（@Entity/@Column/@ManyToOne）。
 * 这里用纯 TS 接口 + 内存表表达同样的数据形状：
 *   users(id, name)
 *   products(id, name, price, stock)
 *   orders(id, userId, productId, quantity, unitPrice, total, status, createdAt)
 */

export interface UserRow {
  id: number;
  name: string;
}

export interface ProductRow {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export interface OrderRow {
  id: number;
  userId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  total: number;
  status: 'paid';
  createdAt: string;
}

/** 列表返回的「关联后」订单行：多了 join 出来的 userName/productName。 */
export type OrderDetailRow = OrderRow & { userName?: string; productName?: string };

/** 一条「SQL 日志」，对应 TypeORM 的 logging: ['query'] 输出。 */
export interface QueryLogEntry {
  sql: string;
  params: (string | number)[];
  ms: number;
  inTransaction: boolean;
}

export interface DatabaseStats {
  queryCount: number;
  inTransaction: boolean;
  tables: Record<string, number>;
  lastQueries: QueryLogEntry[];
}
