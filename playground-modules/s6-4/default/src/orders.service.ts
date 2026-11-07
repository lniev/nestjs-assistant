import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProperty } from './openapi';

/**
 * 订单写模型（内存版）。
 *
 * 真实项目：
 *   - 用 class-validator + ValidationPipe 校验 DTO；
 *   - 用 @nestjs/swagger 的 @ApiProperty 标注文档（本工程用 src/openapi.ts 的手写版）；
 *   - 用 TypeORM/Prisma 落库，这里用内存数组演示。
 */

export interface Order {
  id: number;
  sku: string;
  qty: number;
  amount: number;
  currency: string;
  createdAt: string;
}

/** 创建订单请求体：字段上的 @ApiProperty 会出现在 /docs/openapi.json 的 schema 里。 */
export class CreateOrderDto {
  @ApiProperty({ description: '商品编码', example: 'SKU-001' })
  sku = 'SKU-001';

  @ApiProperty({ description: '购买数量（正整数）', type: 'number', example: 2 })
  qty = 2;

  @ApiProperty({ description: '单价（元）', type: 'number', example: 19.9, required: false })
  price?: number;
}

@Injectable()
export class OrdersService {
  private readonly orders: Order[] = [];
  private nextId = 1;
  private readonly unitPrice = 19.9;

  list(): Order[] {
    return this.orders;
  }

  findOne(id: number): Order | undefined {
    return this.orders.find((order) => order.id === id);
  }

  create(dto: CreateOrderDto): Order {
    const sku = typeof dto?.sku === 'string' && dto.sku.trim() !== '' ? dto.sku.trim() : 'SKU-001';
    const qty = dto?.qty === undefined ? 1 : Number(dto.qty);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new BadRequestException('qty 必须是正整数');
    }
    const price = dto?.price === undefined ? this.unitPrice : Number(dto.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('price 必须是非负数');
    }
    const order: Order = {
      id: this.nextId,
      sku,
      qty,
      amount: Number((price * qty).toFixed(2)),
      currency: 'CNY',
      createdAt: new Date().toISOString(),
    };
    this.nextId += 1;
    this.orders.push(order);
    return order;
  }
}
