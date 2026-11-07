import { Controller, Get, Header } from '@nestjs/common';
import { buildOpenApiDocument, DocumentedRoute } from './openapi';
import { CreateOrderDto } from './orders.service';

/**
 * 文档与上线相关的路由。
 *
 * 真实项目的对应实现：
 *   - GET /docs/openapi.json ≈ SwaggerModule.createDocument(app, config) 的产物；
 *   - GET /docs ≈ SwaggerModule.setup('docs', app, document) 提供的 Swagger UI；
 *   - GET /deploy/checklist 是部署清单（本工程用 JSON 代替 Dockerfile 文件，
 *     因为操练场只运行 TypeScript 源码，不执行容器构建）。
 */

/** 手写的「路由清单」：真实项目里 SwaggerModule 会扫描控制器自动得到它。 */
const DOCUMENTED_ROUTES: DocumentedRoute[] = [
  { method: 'GET', path: '/health', summary: 'liveness 探针：进程活着就返回 200，不检查依赖' },
  { method: 'GET', path: '/health/ready', summary: 'readiness 探针：依赖可用才接流量，不可用返回 503' },
  { method: 'GET', path: '/v1/orders', summary: 'URI 版本化 v1：旧结构订单列表' },
  { method: 'POST', path: '/v1/orders', summary: '创建订单；请求体 schema 来自手写 @ApiProperty', status: 201, body: CreateOrderDto },
  { method: 'GET', path: '/v2/orders', summary: 'URI 版本化 v2：新增 currency 字段' },
  { method: 'GET', path: '/orders', summary: 'Header 版本化：x-api-version=2 返回 v2 结构，否则 v1' },
];

@Controller('docs')
export class DocsController {
  /** 等价 SwaggerModule 的 /docs-json。 */
  @Get('openapi.json')
  document(): Record<string, unknown> {
    return buildOpenApiDocument(DOCUMENTED_ROUTES);
  }

  /** 极简版 Swagger UI：列出文档里的路由，并给出 JSON 地址。 */
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  ui(): string {
    const rows = DOCUMENTED_ROUTES.map(
      (route) =>
        '<tr><td>' + route.method + '</td><td><code>' + route.path + '</code></td><td>' + route.summary + '</td></tr>',
    ).join('');
    return (
      '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>API 文档</title>' +
      '<style>body{font-family:system-ui,sans-serif;padding:24px;line-height:1.6}table{border-collapse:collapse}' +
      'td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}</style></head><body>' +
      '<h1>订单服务 API 文档（手写版 Swagger UI）</h1>' +
      '<p>机器可读文档：<a href="/docs/openapi.json">/docs/openapi.json</a></p>' +
      '<table><thead><tr><th>方法</th><th>路径</th><th>说明</th></tr></thead><tbody>' +
      rows +
      '</tbody></table><p>练习：给 CreateOrderDto 加一个 @ApiProperty 字段，刷新本页与 JSON 观察 schema 变化。</p>' +
      '</body></html>'
    );
  }
}

/** 容器化上线清单：真实项目会把它落实成 Dockerfile + CI 部署流水线。 */
@Controller('deploy')
export class ReleaseController {
  @Get('checklist')
  checklist() {
    return {
      module: 's6-4',
      image: 'node:22-alpine',
      dockerfile: [
        'FROM node:22-alpine',
        'WORKDIR /app',
        'COPY package.json pnpm-lock.yaml ./',
        'RUN corepack enable && pnpm install --frozen-lockfile',
        'COPY . .',
        'RUN pnpm build',
        'ENV NODE_ENV=production',
        'EXPOSE 3000',
        'HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1',
        'CMD ["node", "dist/main.js"]',
      ],
      probes: {
        liveness: '/health（只证明进程活着，失败由 k8s 重启容器）',
        readiness: '/health/ready（检查数据库等依赖，失败只摘流量不重启）',
      },
      rollout: [
        '先以新版本启动，readiness 通过后再逐步切流量（滚动更新）',
        '保留旧版本路由（/v1）至少一个发布周期，确认客户端迁移后再删除',
        '把 OpenAPI JSON 作为构建产物归档，前端与网关据此生成客户端',
      ],
    };
  }
}
