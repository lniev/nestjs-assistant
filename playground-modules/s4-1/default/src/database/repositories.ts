import { Injectable } from '@nestjs/common';
import { InMemoryDatabase } from './database';
import { Order, User } from './entities';

/**
 * 练习 s4-1 · 仓储层（Repository）
 *
 * Service 只依赖这里的**接口**，不知道底层是内存表还是 database。
 * 换成真 ORM 时只要新增 TypeOrmUserRepository implements UserRepository：
 *
 *   @Injectable()
 *   export class TypeOrmUserRepository implements UserRepository {
 *     constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}
 *     async all() { return this.repo.find(); }
 *     ...
 *   }
 *
 * 然后把 AppModule 里 USER_REPOSITORY 的 useClass 换掉，Service/Controller 一行不用改。
 */
export interface UserRepository {
  all(): Promise<User[]>;
  byId(id: number): Promise<User | null>;
  byEmail(email: string): Promise<User | null>;
  create(input: { email: string; name: string }): Promise<User>;
  count(): Promise<number>;
}

export interface OrderRepository {
  all(): Promise<Order[]>;
  byId(id: number): Promise<Order | null>;
  byUser(userId: number): Promise<Order[]>;
  count(): Promise<number>;
}

/** DI 令牌：真实项目里等价于 @InjectRepository(User) 生成的 token。 */
export const USER_REPOSITORY = 'USER_REPOSITORY';
export const ORDER_REPOSITORY = 'ORDER_REPOSITORY';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async all(): Promise<User[]> {
    return this.db.find<User>('users', { orderBy: 'id', direction: 'asc' });
  }

  async byId(id: number): Promise<User | null> {
    return this.db.findById<User>('users', id);
  }

  async byEmail(email: string): Promise<User | null> {
    return this.db.findOne<User>('users', {
      where: (row) => String(row.email).toLowerCase() === email.toLowerCase(),
    });
  }

  async create(input: { email: string; name: string }): Promise<User> {
    return this.db.insert<User>('users', {
      email: input.email,
      name: input.name,
      createdAt: new Date().toISOString(),
    });
  }

  async count(): Promise<number> {
    return this.db.count('users');
  }
}

@Injectable()
export class InMemoryOrderRepository implements OrderRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async all(): Promise<Order[]> {
    return this.db.find<Order>('orders', { orderBy: 'id', direction: 'asc' });
  }

  async byId(id: number): Promise<Order | null> {
    return this.db.findById<Order>('orders', id);
  }

  async byUser(userId: number): Promise<Order[]> {
    return this.db.find<Order>('orders', { where: (row) => Number(row.userId) === userId });
  }

  async count(): Promise<number> {
    return this.db.count('orders');
  }
}
