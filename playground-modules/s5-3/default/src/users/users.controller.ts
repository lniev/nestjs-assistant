import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { UserDto, UsersService } from './users.service';

/**
 * 用户接口。练习观察点：
 *   GET /users      -> 手机号已脱敏（138****8000）
 *   GET /users/1/raw -> 库里只有密文 + 慢哈希
 *   POST /users     -> 入库前自动加密/哈希（用请求台发 {"name":"carol","password":"p@ss123","phone":"13711112222"}）
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(): UserDto[] {
    return this.usersService.listMasked();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): UserDto {
    return this.usersService.findMasked(id);
  }

  @Get(':id/raw')
  raw(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findRaw(id);
  }

  @Post()
  create(@Body() body: { name?: string; password?: string; phone?: string; role?: string }): UserDto {
    return this.usersService.create(body ?? {});
  }
}
