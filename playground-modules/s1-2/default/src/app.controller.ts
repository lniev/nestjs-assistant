import { Controller, Get } from '@nestjs/common';

/** 根控制器：健康检查 + 路由表速览。 */
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', module: 's1-2', time: new Date().toISOString() };
  }

  /** 在请求台里先把这几条跑一遍，再改代码观察变化。 */
  @Get('routes')
  routes() {
    return {
      catalog: [
        'GET /cats',
        'GET /cats/search?name=Tom',
        'GET /cats/:id',
        'POST /cats',
        'PATCH /cats/:id',
        'DELETE /cats/:id',
      ],
      hint: '@Param 从路径取值，@Query 从 ? 查询串取值，@Body 从请求体取值；路由声明顺序会影响匹配结果。',
    };
  }
}
