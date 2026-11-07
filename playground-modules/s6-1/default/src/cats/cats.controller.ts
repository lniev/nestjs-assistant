import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Cat, CatsService, CreateCatDto } from './cats.service';

/**
 * 正常业务接口（默认工程必须是一个可运行服务）。
 * GET /cats、GET /cats/1、POST /cats 保持和 sandbox 示例一致，方便对照。
 */
@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Get()
  findAll(): Cat[] {
    return this.catsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Cat {
    return this.catsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateCatDto): Cat {
    return this.catsService.create(body ?? {});
  }
}
