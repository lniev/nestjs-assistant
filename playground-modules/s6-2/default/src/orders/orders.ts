import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthActor, AuthService } from '../auth/auth';
import { ERROR_CODES } from '../common/error-contract';

export interface Order {
  id: number;
  userId: number;
  item: string;
  quantity: number;
  amount: number;
}

/**
 * 订单服务（内存版）。e2e 主链路：登录 -> 下单 -> 查询。
 * 真实项目：OrdersService 注入 Repository，下单要落库 + 扣库存（事务）。
 */
@Injectable()
export class OrdersService {
  private readonly orders: Order[] = [
    { id: 1, userId: 1, item: '机械键盘', quantity: 1, amount: 399 },
    { id: 2, userId: 2, item: '显示器', quantity: 1, amount: 1299 },
  ];
  private nextId = 3;

  listFor(actor: AuthActor): Order[] {
    if (actor.role === 'staff') return this.orders;
    return this.orders.filter((order) => order.userId === actor.userId);
  }

  findFor(actor: AuthActor, id: number): Order {
    const order = this.orders.find((item) => item.id === id);
    if (!order) {
      // 404 只用于「真的不存在」，越权统一 403（见下一个判断）。
      throw new NotFoundException({ code: ERROR_CODES.ORDER_NOT_FOUND, message: '订单 #' + id + ' 不存在' });
    }
    if (order.userId !== actor.userId && actor.role !== 'staff') {
      throw new ForbiddenException({ code: ERROR_CODES.ORDER_FORBIDDEN, message: '无权访问该订单' });
    }
    return order;
  }

  create(actor: AuthActor, dto: { item?: string; quantity?: number }): Order {
    const item = typeof dto?.item === 'string' ? dto.item.trim() : '';
    if (item === '') {
      throw new BadRequestException({ code: ERROR_CODES.ORDER_ITEMS_REQUIRED, message: 'item 不能为空' });
    }
    const quantity = dto?.quantity === undefined ? 1 : Number(dto.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException({ code: ERROR_CODES.ORDER_QUANTITY_INVALID, message: 'quantity 必须是正整数' });
    }
    const order: Order = { id: this.nextId, userId: actor.userId, item, quantity, amount: 100 * quantity };
    this.nextId += 1;
    this.orders.push(order);
    return order;
  }
}

/**
 * Bearer 守卫（等价于 AuthGuard('jwt')）。
 * 区分两种 401：没带 token（AUTH_TOKEN_MISSING）与 token 无效/过期（AUTH_TOKEN_INVALID），
 * e2e 才能分别断言 —— 这是「错误码字段」的价值所在。
 */
@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const raw = String(request.headers?.authorization ?? '');
    const token = raw.replace(/^Bearer\s+/i, '').trim();
    if (token === '') {
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_TOKEN_MISSING, message: '缺少 Authorization: Bearer <token>' });
    }
    const actor = this.authService.validate(token);
    if (!actor) {
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_TOKEN_INVALID, message: 'token 无效或已过期' });
    }
    request.actor = actor;
    return true;
  }
}

/**
 * 受保护资源。请求台里先 GET /auth/demo?username=alice&password=s3cret 拿 token，
 * 再在请求头加 Authorization: Bearer <token>。
 */
@Controller('orders')
@UseGuards(BearerAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@Req() request: any) {
    const actor: AuthActor = request.actor;
    return { as: actor.username, orders: this.ordersService.listFor(actor) };
  }

  @Get(':id')
  findOne(@Req() request: any, @Param('id', ParseIntPipe) id: number): Order {
    return this.ordersService.findFor(request.actor, id);
  }

  @Post()
  create(@Req() request: any, @Body() body: { item?: string; quantity?: number }): Order {
    return this.ordersService.create(request.actor, body ?? {});
  }
}
