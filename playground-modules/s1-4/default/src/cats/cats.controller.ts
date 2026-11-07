import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Cat, CatsService, CreateCatDto } from './cats.service';

/**
 * 控制器保持薄：只绑定路由与参数，业务逻辑交给 CatsService。
 * 它需要的 CatsService 由 CatsModule.providers 提供。
 */
@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Get()
  findAll(): Cat[] {
    return this.catsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Cat {
    return this.catsService.findOne(Number(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCatDto): Cat {
    return this.catsService.create(dto);
  }
}
