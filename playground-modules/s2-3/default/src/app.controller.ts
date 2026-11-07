import { Controller, Get } from '@nestjs/common';

interface UserView {
  id: number;
  name: string;
  role: string;
}

/**
 * 演示用控制器：每个 handler 的返回值都会被 TransformInterceptor 统一包装，
 * 所以控制器里只写业务数据，不用手拼 { code, data } 外壳。
 */
@Controller()
export class AppController {
  private readonly users: UserView[] = [
    { id: 1, name: 'Ada', role: 'admin' },
    { id: 2, name: 'Linus', role: 'member' },
  ];

  @Get('health')
  health() {
    return { status: 'ok', module: 's2-3' };
  }

  /** 数组返回值：包装后仍在 data 里。 */
  @Get('users')
  listUsers(): UserView[] {
    return this.users;
  }

  /** 故意慢 80ms：运行日志里会出现 [slow] GET /slow 80ms… */
  @Get('slow')
  async slow(): Promise<{ delayedMs: number }> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { delayedMs: 80 };
  }

  /**
   * 故意抛未知异常：
   * LoggingInterceptor 的 catchError 先记录失败日志，再把异常原样抛回，
   * 最终由 Nest 默认异常层返回 500（下一节 s2-4 才会自定义错误契约）。
   */
  @Get('boom')
  boom(): never {
    throw new Error('boom：这是拦截器 catchError 的演示异常');
  }
}
