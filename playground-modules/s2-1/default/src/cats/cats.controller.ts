import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Cat, CatsService } from './cats.service';
import { CreateCatDto, ListCatsQuery } from './dto';

/**
 * 控制器只接收「已经过管道处理」的数据：
 *   - @Param('id', ParseIntPipe)：参数级管道，把字符串转成 number，非法直接 400
 *   - @Query() query: ListCatsQuery：全局 ValidationPipe 负责校验/白名单
 *   - @Body() dto: CreateCatDto：全局 ValidationPipe 负责校验，handler 里不用写防御代码
 *
 * 这就是「非法请求进不了控制器」：校验失败时 handler 根本不会被调用。
 */
@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  /** GET /cats?name=Tom&limit=5 —— 管道校验查询参数。 */
  @Get()
  findAll(@Query() query: ListCatsQuery): Cat[] {
    return this.catsService.findAll(query.name, query.limit);
  }

  /** GET /cats/abc —— ParseIntPipe 直接返回 400，控制器不执行。 */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Cat {
    return this.catsService.findOne(id);
  }

  /** POST /cats —— 缺 name / age 非法 → 400；多余字段被白名单剥离。 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCatDto): Cat {
    return this.catsService.create(dto);
  }
}
