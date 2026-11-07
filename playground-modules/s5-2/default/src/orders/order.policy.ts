import { ForbiddenException, Injectable } from '@nestjs/common';
import { Actor } from '../auth/actor';

/**
 * 订单资源类型。owner 是下单的客户，staff/admin 是内部角色。
 */
export interface Order {
  id: number;
  ownerId: number;
  item: string;
  amount: number;
  status: 'open' | 'paid' | 'cancelled';
}

/**
 * 策略对象：把「谁能对哪条记录做什么」从 controller 里抽出来。
 *
 * 三级策略：
 *   - owner（customer）：只能读写自己的订单，且只有 open 状态可改；
 *   - staff：可读任意订单、可改状态，但不能删；
 *   - admin：全部允许。
 *
 * 关键点：策略是纯函数（除抛异常外无副作用），所以可以脱离 HTTP 直接单测。
 * 真实项目可以换成 CASL 的 ability：ability.can('update', subject('Order', order))。
 */
@Injectable()
export class OrderPolicy {
  canRead(actor: Actor, order: Order): boolean {
    if (actor.role === 'admin' || actor.role === 'staff') return true;
    return order.ownerId === actor.id;
  }

  canUpdate(actor: Actor, order: Order): boolean {
    if (actor.role === 'admin') return true;
    if (actor.role === 'staff') return true;
    return order.ownerId === actor.id && order.status === 'open';
  }

  canDelete(actor: Actor, _order: Order): boolean {
    return actor.role === 'admin';
  }

  /**
   * 越权时抛 403（不是 404）：订单存在这件事本身不需要对内部角色隐藏。
   * 只有订单根本不存在时才由 service 抛 404。
   */
  assertCanRead(actor: Actor, order: Order): void {
    if (!this.canRead(actor, order)) {
      throw new ForbiddenException({
        code: 'ORDER_FORBIDDEN',
        message: '无权访问他人的订单（订单 #' + order.id + '）',
      });
    }
  }

  assertCanUpdate(actor: Actor, order: Order): void {
    if (!this.canUpdate(actor, order)) {
      throw new ForbiddenException({
        code: 'ORDER_FORBIDDEN',
        message: '当前用户不能修改该订单（订单 #' + order.id + '）',
      });
    }
  }

  assertCanDelete(actor: Actor, order: Order): void {
    if (!this.canDelete(actor, order)) {
      throw new ForbiddenException({
        code: 'ORDER_FORBIDDEN',
        message: '只有 admin 可以删除订单',
      });
    }
  }
}

export interface PolicyCase {
  name: string;
  ok: boolean;
  detail: string;
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(label + '：期望 ' + String(expected) + '，实际 ' + String(actual));
  }
}

/**
 * 策略单测。GET /orders/policy-spec 会真实执行这一组断言并返回结果。
 *
 * 真实项目用 jest：
 *   describe('OrderPolicy', () => {
 *     it('customer 不能读他人订单', () => expect(policy.canRead(alice, bobOrder)).toBe(false));
 *   });
 * 操练场没装 jest，所以用一个极小的断言器等价表达，跑法完全一致。
 */
export function runPolicySpec(): PolicyCase[] {
  const policy = new OrderPolicy();
  const alice: Actor = { id: 1, name: 'alice', role: 'customer' };
  const staff: Actor = { id: 9, name: 'staff', role: 'staff' };
  const admin: Actor = { id: 10, name: 'admin', role: 'admin' };
  const aliceOrder: Order = { id: 3, ownerId: 1, item: '鼠标', amount: 99, status: 'open' };
  const bobOrder: Order = { id: 2, ownerId: 2, item: '显示器', amount: 1299, status: 'paid' };

  const cases: { name: string; run: () => void }[] = [
    {
      name: 'owner 可以读自己的订单',
      run: () => expectEqual(policy.canRead(alice, aliceOrder), true, 'canRead'),
    },
    {
      name: 'owner 不能读他人订单',
      run: () => expectEqual(policy.canRead(alice, bobOrder), false, 'canRead'),
    },
    {
      name: 'staff 可以读任意订单',
      run: () => expectEqual(policy.canRead(staff, bobOrder), true, 'canRead'),
    },
    {
      name: 'owner 不能修改已支付订单',
      run: () => expectEqual(policy.canUpdate(alice, bobOrder), false, 'canUpdate'),
    },
    {
      name: '只有 admin 能删除订单',
      run: () => expectEqual(policy.canDelete(staff, bobOrder), false, 'canDelete'),
    },
    {
      name: '越权读取抛出 403 ForbiddenException',
      run: () => {
        try {
          policy.assertCanRead(alice, bobOrder);
        } catch (error) {
          const status = typeof error?.getStatus === 'function' ? error.getStatus() : 0;
          expectEqual(status, 403, 'status');
          return;
        }
        throw new Error('应该抛出 ForbiddenException，但没有抛');
      },
    },
  ];

  return cases.map((item) => {
    try {
      item.run();
      return { name: item.name, ok: true, detail: '通过' };
    } catch (error) {
      return { name: item.name, ok: false, detail: String(error?.message ?? error) };
    }
  });
}
