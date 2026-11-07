import { Controller, Get, Module } from '@nestjs/common';
import { InMemoryDatabase } from './database/database';
import {
  InMemoryOrderRepository,
  InMemoryUserRepository,
  ORDER_REPOSITORY,
  USER_REPOSITORY,
} from './database/repositories';
import { OrdersController, UsersController } from './users/users.controller';
import { OrdersService, UsersService } from './users/users.service';

/**
 * 练习 s4-1 · ORM 接入与数据建模（内存仓储版）
 *
 * 分层：Controller → Service → Repository（接口）→ 内存数据库（模拟 DataSource）
 *
 * 真实项目的接线方式（对照着看）：
 *
 *   TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: ... }),
 *   TypeOrmModule.forFeature([User, Order]),
 *   { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
 *
 * 操练场里用异步工厂先把「迁移」跑完再交给容器：
 *   - 换真库时这一步对应 TypeORM migration:run / prisma migrate deploy；
 *   - 生产环境不要用 synchronize: true，否则表结构不可控。
 *
 * 可改：把 GET /users 的返回改成支持 ?page=1&size=10（这就是 s4-2 的分页预演）。
 */
@Controller()
export class AppController {
  constructor(private readonly db: InMemoryDatabase) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      module: 's4-1',
      migrated: this.db.isMigrated(),
      tables: this.db.tableNames(),
    };
  }

  /** 查看「迁移后的表结构」，相当于 SHOW COLUMNS。 */
  @Get('schema')
  schema() {
    return { tables: this.db.describe() };
  }

  /** 手动再跑一次迁移，验证幂等（真实项目由 CLI 执行，不暴露成接口）。 */
  @Get('migrate')
  async migrate() {
    const result = await this.db.runMigrations();
    return { ...result, note: '迁移是幂等的：已建表时 applied 为空数组' };
  }
}

@Module({
  controllers: [AppController, UsersController, OrdersController],
  providers: [
    {
      // 模拟「应用启动时初始化 DataSource 并执行迁移」
      provide: InMemoryDatabase,
      useFactory: async () => {
        const db = new InMemoryDatabase();
        await db.runMigrations();
        return db;
      },
    },
    {
      // 真实项目：TypeOrmModule.forFeature + @InjectRepository(User)
      provide: USER_REPOSITORY,
      useFactory: (db: InMemoryDatabase) => new InMemoryUserRepository(db),
      inject: [InMemoryDatabase],
    },
    {
      provide: ORDER_REPOSITORY,
      useFactory: (db: InMemoryDatabase) => new InMemoryOrderRepository(db),
      inject: [InMemoryDatabase],
    },
    UsersService,
    OrdersService,
  ],
})
export class AppModule {}
