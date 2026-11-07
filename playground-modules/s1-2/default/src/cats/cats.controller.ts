import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Cat, CreateCatDto, UpdateCatDto } from './cats.model';

/**
 * 猫咪资源的全部 REST 路由都在 /cats 下（控制器级路径前缀）。
 *
 * 观察点：
 *   1. @Get('search') 必须写在 @Get(':id') 前面，否则 search 会被当成 id=search。
 *   2. @Param 取路径参数（字符串），@Query 取查询串，@Body 取请求体。
 *   3. @HttpCode 控制成功响应状态码；错误用 BadRequestException / NotFoundException 抛出。
 */
@Controller('cats')
export class CatsController {
  private readonly cats: Cat[] = [
    { id: 1, name: 'Tom', age: 3 },
    { id: 2, name: 'Jerry', age: 2 },
  ];

  private nextId = 3;

  /** GET /cats?name=Tom —— @Query 版过滤。 */
  @Get()
  findAll(@Query('name') name?: string): Cat[] {
    if (name === undefined || name === '') return this.cats;
    return this.cats.filter((cat) => cat.name.toLowerCase() === name.toLowerCase());
  }

  /** GET /cats/search?name=Tom —— 同样是 @Query，用独立子路径演示路由声明顺序。 */
  @Get('search')
  search(@Query('name') name?: string) {
    return { mode: 'query', keyword: name ?? null, result: this.findAll(name) };
  }

  /** GET /cats/:id —— @Param 版：字符串参数要自己转数字并校验。 */
  @Get(':id')
  findOne(@Param('id') id: string): Cat {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException('id 必须是正整数');
    }
    const cat = this.cats.find((item) => item.id === numeric);
    if (!cat) throw new NotFoundException('猫咪 #' + id + ' 不存在');
    return cat;
  }

  /** POST /cats —— @Body 取值，缺 name 返回 400；成功返回 201。 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCatDto): Cat {
    if (dto === null || typeof dto.name !== 'string' || dto.name.trim() === '') {
      throw new BadRequestException('name 必填且不能为空');
    }
    const age = dto.age === undefined ? 0 : Number(dto.age);
    if (!Number.isFinite(age) || age < 0) throw new BadRequestException('age 必须是非负数字');
    const cat: Cat = { id: this.nextId, name: dto.name.trim(), age };
    this.nextId += 1;
    this.cats.push(cat);
    return cat;
  }

  /** PATCH /cats/:id —— 局部更新；空 body 直接返回原对象。 */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCatDto): Cat {
    const cat = this.findOne(id);
    if (dto !== null && dto !== undefined) {
      if (dto.name !== undefined) {
        if (typeof dto.name !== 'string' || dto.name.trim() === '') {
          throw new BadRequestException('name 不能为空');
        }
        cat.name = dto.name.trim();
      }
      if (dto.age !== undefined) {
        const age = Number(dto.age);
        if (!Number.isFinite(age) || age < 0) throw new BadRequestException('age 必须是非负数字');
        cat.age = age;
      }
    }
    return cat;
  }

  /** DELETE /cats/:id —— 成功返回 204（没有响应体）。 */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    const cat = this.findOne(id);
    this.cats.splice(this.cats.indexOf(cat), 1);
  }
}
