import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Order } from '../database/entities';
import {
  ORDER_REPOSITORY,
  OrderRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../database/repositories';

/**
 * 练习 s4-1 · 业务层（Service）
 *
 * 职责边界：
 *   Controller  只做 HTTP 入参/出参，不碰数据库；
 *   Service     只依赖仓储接口，负责业务规则（邮箱唯一、用户存在性校验）；
 *   Repository  只负责持久化，不知道业务规则。
 *
 * 这样把「内存仓储换成 ORM 仓储」时，本文件的方法签名一行都不用改。
 */

export interface CreateUserInput {
  email?: string;
  name?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
  ) {}

  list() {
    return this.users.all();
  }

  async findById(id: number) {
    const user = await this.users.byId(id);
    if (!user) throw new NotFoundException('用户不存在：' + id);
    return user;
  }

  async create(input: CreateUserInput) {
    const email = typeof input?.email === 'string' ? input.email.trim() : '';
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('email 必须是合法邮箱地址');
    }
    if (name === '') throw new BadRequestException('name 不能为空');
    if (await this.users.byEmail(email)) {
      // 真实项目还要在数据库层建唯一索引，防止并发注册写进两条（唯一约束兜底）。
      throw new ConflictException('邮箱已存在：' + email);
    }
    return this.users.create({ email, name });
  }

  count() {
    return this.users.count();
  }
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orders: OrderRepository,
    private readonly usersService: UsersService,
  ) {}

  list(): Promise<Order[]> {
    return this.orders.all();
  }

  async findById(id: number): Promise<Order> {
    const order = await this.orders.byId(id);
    if (!order) throw new NotFoundException('订单不存在：' + id);
    return order;
  }

  /** 下单列表：先校验用户存在（真实项目里由外键约束保证）。 */
  async listByUser(userId: number): Promise<Order[]> {
    await this.usersService.findById(userId);
    return this.orders.byUser(userId);
  }

  count() {
    return this.orders.count();
  }
}
