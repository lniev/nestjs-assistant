import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { CATS_REPOSITORY, Cat, CatsRepository, CreateCatDto } from './cats.repository';

/**
 * 控制器只做「参数 → 调用 → 响应」，不关心存储实现。
 *
 * 这里用 @Inject(CATS_REPOSITORY) 注入令牌对应的 provider；
 * 也可以直接写成 constructor(private readonly repo: CatsService) ——
 * 类作为 token 时 Nest 会自动按类型注入（见 s1-4）。
 */
@Controller('cats')
export class CatsController {
  constructor(@Inject(CATS_REPOSITORY) private readonly catsRepository: CatsRepository) {}

  @Get()
  findAll(): Cat[] {
    return this.catsRepository.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Cat {
    return this.catsRepository.findOne(Number(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCatDto): Cat {
    return this.catsRepository.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Cat {
    return this.catsRepository.remove(Number(id));
  }
}
