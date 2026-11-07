import { AuthService } from '../auth/auth';
import { ErrorEnvelope, toErrorEnvelope } from '../common/error-contract';
import { BearerAuthGuard, OrdersService } from '../orders/orders';

/**
 * e2e 回归套件（进程内版）。
 *
 * 真实项目用 supertest 打真实 HTTP：
 *   const app = moduleFixture.createNestApplication();
 *   await app.init();
 *   await request(app.getHttpServer()).post('/auth/login').send({}).expect(401)
 *     .expect((res) => expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS'));
 *
 * 操练场没装 supertest，但同一套断言完全可以对着「守卫 + service + 错误过滤器」
 * 直接跑：错误契约由 toErrorEnvelope 统一生成，和 HTTP 层用的是同一份逻辑，
 * 所以断言 401/403/400 + code 与真实 e2e 等价。
 *
 * 覆盖边界而不是只测 happy path：401（两种）、403、400、以及登录->下单->查询主链路。
 */

export interface ScenarioResult {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
  envelope?: ErrorEnvelope;
}

function fakeRequest(path: string, headers: Record<string, string> = {}): any {
  return { headers, originalUrl: path, url: path };
}

function guardContext(request: any): any {
  return { switchToHttp: () => ({ getRequest: () => request }) };
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(label + ' 期望 ' + String(expected) + '，实际 ' + String(actual));
  }
}

/** 跑一个必然抛错的场景，并把异常转成「客户端会看到的错误体」。 */
function capture(run: () => any, path: string, headers: Record<string, string> = {}): ErrorEnvelope {
  try {
    run();
  } catch (error) {
    return toErrorEnvelope(error, fakeRequest(path, headers));
  }
  throw new Error('期望抛出异常，但没有抛');
}

export function runRegression(
  auth: AuthService,
  orders: OrdersService,
): { results: ScenarioResult[]; passed: number; failed: number } {
  const cases: { name: string; run: () => void }[] = [
    {
      name: '登录失败：401 + AUTH_INVALID_CREDENTIALS',
      run: () => {
        const envelope = capture(() => auth.login('alice', 'wrong-password'), '/auth/login');
        expectEqual(envelope.statusCode, 401, 'statusCode');
        expectEqual(envelope.code, 'AUTH_INVALID_CREDENTIALS', 'code');
        if (!envelope.traceId) throw new Error('错误体缺少 traceId');
      },
    },
    {
      name: '未带 token 访问 /orders：401 + AUTH_TOKEN_MISSING',
      run: () => {
        const guard = new BearerAuthGuard(auth);
        const envelope = capture(() => guard.canActivate(guardContext(fakeRequest('/orders'))), '/orders');
        expectEqual(envelope.statusCode, 401, 'statusCode');
        expectEqual(envelope.code, 'AUTH_TOKEN_MISSING', 'code');
      },
    },
    {
      name: 'token 无效：401 + AUTH_TOKEN_INVALID',
      run: () => {
        const guard = new BearerAuthGuard(auth);
        const request = fakeRequest('/orders', { authorization: 'Bearer not-a-real-token' });
        const envelope = capture(() => guard.canActivate(guardContext(request)), '/orders');
        expectEqual(envelope.statusCode, 401, 'statusCode');
        expectEqual(envelope.code, 'AUTH_TOKEN_INVALID', 'code');
      },
    },
    {
      name: '越权读他人订单：403 + ORDER_FORBIDDEN',
      run: () => {
        const bob = auth.login('bob', 'hunter2').user;
        const envelope = capture(() => orders.findFor(bob, 1), '/orders/1'); // 订单 1 属于 alice
        expectEqual(envelope.statusCode, 403, 'statusCode');
        expectEqual(envelope.code, 'ORDER_FORBIDDEN', 'code');
      },
    },
    {
      name: '下单缺少 item：400 + ORDER_ITEMS_REQUIRED',
      run: () => {
        const alice = auth.login('alice', 's3cret').user;
        const envelope = capture(() => orders.create(alice, {}), '/orders');
        expectEqual(envelope.statusCode, 400, 'statusCode');
        expectEqual(envelope.code, 'ORDER_ITEMS_REQUIRED', 'code');
      },
    },
    {
      name: '主链路：登录 -> 下单 -> 查询本人订单',
      run: () => {
        const { token, user } = auth.login('alice', 's3cret');
        const guard = new BearerAuthGuard(auth);
        const request = fakeRequest('/orders', { authorization: 'Bearer ' + token });
        expectEqual(guard.canActivate(guardContext(request)), true, 'guard 放行');
        const order = orders.create(request.actor, { item: '耳机', quantity: 2 });
        expectEqual(order.userId, user.userId, 'order.userId');
        const found = orders.findFor(request.actor, order.id);
        expectEqual(found.item, '耳机', '查回的 item');
      },
    },
  ];

  const results: ScenarioResult[] = [];
  for (const item of cases) {
    const started = Date.now();
    try {
      item.run();
      results.push({ name: item.name, ok: true, detail: '通过', ms: Date.now() - started });
    } catch (error) {
      results.push({ name: item.name, ok: false, detail: String(error?.message ?? error), ms: Date.now() - started });
    }
  }
  const failed = results.filter((item) => !item.ok).length;
  return { results, passed: results.length - failed, failed };
}
