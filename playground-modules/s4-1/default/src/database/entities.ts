/**
 * 练习 s4-1 · 数据建模：实体 + 列定义
 *
 * 操练场没有安装 @nestjs/typeorm / prisma，也不应该联网连数据库，所以这里用
 * 「纯 TypeScript 接口 + 列元数据」模拟 ORM 实体。真实项目里等价写法是：
 *
 *   @Entity('users')
 *   export class User {
 *     @PrimaryGeneratedColumn() id: number;
 *     @Column({ unique: true }) email: string;
 *     @Column() name: string;
 *     @CreateDateColumn() createdAt: Date;
 *   }
 *
 *   @Entity('orders')
 *   export class Order {
 *     @PrimaryGeneratedColumn() id: number;
 *     @Column() userId: number;
 *     @ManyToOne(() => User) @JoinColumn({ name: 'userId' }) user: User;
 *     @Column('decimal', { precision: 10, scale: 2 }) amount: number;
 *   }
 *
 * 列定义（ColumnDef）在这里被 migrations 用来建表，被 repository 用来做字段校验，
 * 换成真 ORM 后这些信息就交给装饰器/迁移文件了。
 */

export interface ColumnDef {
  name: string;
  type: 'int' | 'varchar' | 'decimal' | 'timestamp';
  nullable?: boolean;
  unique?: boolean;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
}

/** 用户实体。 */
export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

/** 订单实体（userId 就是真实项目里的外键 @ManyToOne）。 */
export interface Order {
  id: number;
  userId: number;
  productName: string;
  amount: number;
  status: 'pending' | 'paid';
  createdAt: string;
}

export const USERS_TABLE: TableDef = {
  name: 'users',
  columns: [
    { name: 'id', type: 'int' },
    { name: 'email', type: 'varchar', unique: true },
    { name: 'name', type: 'varchar' },
    { name: 'createdAt', type: 'timestamp' },
  ],
};

export const ORDERS_TABLE: TableDef = {
  name: 'orders',
  columns: [
    { name: 'id', type: 'int' },
    { name: 'userId', type: 'int' },
    { name: 'productName', type: 'varchar' },
    { name: 'amount', type: 'decimal' },
    { name: 'status', type: 'varchar' },
    { name: 'createdAt', type: 'timestamp' },
  ],
};
