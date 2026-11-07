import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../auth/actor';
import { Order, OrderPolicy } from './order.policy';

/**
 * 订单内存仓储 + 业务规则。
 *
 * 真实项目里这里注入 Repository（@nestjs/typeorm）或 Prisma Client；
 * 操练场用一个数组保存，重启即重置，专注练授权流程。
 */
@Injectable()
export class OrdersService {
  private readonly orders: Order[] = [
    { id: 1, ownerId: 1, item: '机械键盘', amount: 399, status: 'open' },
    { id: 2, ownerId: 2, item: '显示器', amount: 1299, status: 'paid' },
    { id: 3, ownerId: 1, item: '鼠标', amount: 99, status: 'open' },
  ];

  constructor(private readonly policy: OrderPolicy) {}

  /** 列表：按策略过滤，客户只看得到自己的订单。 */
  listFor(actor: Actor): Order[] {
    return this.orders.filter((order) => this.policy.canRead(actor, order));
  }

  /**
   * 读取单条：先判存在（404），再判权限（403）。
   * 顺序很重要：别人访问不存在的订单和访问他人的订单，应该得到不同错误。
   */
  findFor(actor: Actor, id: number): Order {
    const order = this.findExisting(id);
    this.policy.assertCanRead(actor, order);
    return order;
  }

  updateStatus(actor: Actor, id: number, status: Order['status']): Order {
    const order = this.findExisting(id);
    this.policy.assertCanUpdate(actor, order);
    if (['open', 'paid', 'cancelled'].indexOf(status) < 0) {
      throw new BadRequestException({
        code: 'ORDER_STATUS_INVALID',
        message: 'status 只能是 open / paid / cancelled',
      });
    }
    order.status = status;
    return order;
  }

  remove(actor: Actor, id: number): { deleted: number } {
    const order = this.findExisting(id);
    this.policy.assertCanDelete(actor, order);
    const index = this.orders.indexOf(order);
    this.orders.splice(index, 1);
    return { deleted: order.id };
  }

  /** 内部角色（staff/admin）能看到全部订单，路由层用 RolesGuard 保证角色。 */
  findAll(): Order[] {
    return this.orders;
  }

  private findExisting(id: number): Order {
    const order = this.orders.find((item) => item.id === id);
    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: '订单 #' + id + ' 不存在',
      });
    }
    return order;
  }
}
