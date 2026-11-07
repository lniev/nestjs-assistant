# 企业级 NestJS 开发知识地图 — 内容生成规范（给 map agent）

## 产物
`/Users/lniev/ds-plugins/nest-assistant/knowledge/enterprise-map.json`
单个 JSON 对象（UTF-8，无注释）。写完用 `node -e "JSON.parse(...)"` 校验。

## 定位
面向"已经会基础 NestJS、要进企业做后端/中间件"的开发者：把企业项目真正需要的能力，
组织成**分层知识地图**：每个领域给出"为什么需要、最佳实践、成熟度 L1-L4、上线检查清单、反模式、关键 Nest API"。

## 素材
- 官方文档页面清单（含中文标题占位、章节结构）：`knowledge/_index.json`（`pages[]` 的 id 必须可用于引用）。
- 官方原文（本地，只读，不要联网）：`/tmp/docs-repo/docs.nestjs.com-master/content/<source>`。
  建议重点读：`fundamentals/*`、`application/*`、`security/*`、`data/*`、`observability/*`、
  `reliability/*`、`http/*`、`microservices/*`、`recipes/cqrs.md`、`deployment.md`、`faq/request-lifecycle.md`。
- 不必逐页读完；按领域挑关键页读，确保建议与 Nest 真实能力对应。

## Schema（严格按此结构，字段全部必填）

```json
{
  "titleZh": "企业级 NestJS 开发知识地图",
  "intro": "2-3 句总述（120-200 字）：企业级开发关注什么，这张地图怎么用。",
  "layers": [
    { "id": "foundation", "titleZh": "工程基础层", "description": "一句话说明这一层解决什么（30-60 字）" }
  ],
  "maturity": [
    { "level": "L1", "titleZh": "能跑", "description": "该成熟度的判定标准（30-80 字）" },
    { "level": "L2", "titleZh": "可维护", "description": "..." },
    { "level": "L3", "titleZh": "可观测、可扩展", "description": "..." },
    { "level": "L4", "titleZh": "平台化", "description": "..." }
  ],
  "domains": [
    {
      "id": "architecture",
      "titleZh": "架构与模块化",
      "title": "Architecture & modularization",
      "layerId": "foundation",
      "essential": "为什么企业级项目需要它（80-150 字）",
      "practices": [
        {
          "title": "实践标题（6-18 字）",
          "detail": "怎么做、解决什么问题、注意什么（100-220 字）",
          "level": "L2",
          "pageRefs": ["fundamentals/dynamic-modules", "modules"]
        }
      ],
      "checklist": ["上线/评审前可勾选的检查项（20-50 字）"],
      "antiPatterns": ["常见反模式（20-50 字）"],
      "nestApi": ["@Module", "APP_INTERCEPTOR", "ConfigModule.forRoot()"]
    }
  ],
  "projectTemplate": {
    "summary": "推荐的企业项目组织方式（80-150 字）",
    "tree": [
      "src/",
      "  main.ts                 # 初始化、全局配置",
      "  app.module.ts",
      "  common/                 # 过滤器/管道/拦截器/装饰器",
      "  config/",
      "  modules/",
      "  ..."
    ]
  }
}
```

## 覆盖要求（domains 12-14 个，按 layers 分组）
建议领域（可合并/微调，但必须覆盖这些主题）：
1. 架构与模块化（模块边界、分层、DDD-lite、依赖方向、共享模块）
2. 配置与环境（ConfigModule、校验、多环境、密钥管理）
3. 请求生命周期与横切关注点（中间件/守卫/管道/拦截器/异常过滤器、全局注册、执行顺序）
4. 校验与契约（DTO、class-validator、class-transformer、全局 ValidationPipe、OpenAPI 契约同步）
5. 认证与授权（Passport/JWT、RBAC/ABAC、Guard 策略、Token 刷新、权限缓存）
6. 数据访问与事务（TypeORM/Prisma、Repository 模式、事务、迁移、分页、N+1）
7. 缓存与性能（缓存策略、Redis、HTTP 压缩、连接池、限流、压测）
8. 异步与消息（队列、事件、outbox、幂等、重试、死信、微服务传输器选型）
9. 可靠性与容错（健康检查、超时、重试、熔断/降级、锁、分布式事务取舍）
10. 可观测性（结构化日志、OpenTelemetry 链路、指标、错误监控、APM 选型）
11. 安全（CORS/CSRF/Helmet、限流、加密哈希、输入校验、依赖审计）
12. 测试与质量（单元测试、e2e、测试模块、覆盖率、契约测试、CI 门禁）
13. 交付与运维（Docker、配置注入、优雅停机、多实例、灰度、迁移发布、Devtools/CI-CD）
14. API 设计（版本化、OpenAPI、分页/错误码、幂等键、SSE/WebSocket/webhook 选型）

每个 domain 的 `practices` 3-5 条；`checklist` 3-5 条；`antiPatterns` 2-3 条；`nestApi` 3-8 个。
`pageRefs` 必须是 `_index.json` 中真实存在的 page id（0-3 个/条实践）。

## 质量要求
- 简体中文；API/包名英文原样。所有建议必须能在 NestJS 官方文档中找到对应能力（可引用页面）。
- `layerId` 必须在 `layers[].id` 中；`level` 必须是 L1-L4 之一。
- 总量控制在 12-16KB JSON 以内，**一次 write 写完**（约 8-12k tokens；如果写不下，先写
  `enterprise-map.json` 的前半 + 用一个 node 脚本合并？不要——请精简措辞，保证一次 write 完成）。

## 完成后
用 node 校验 JSON + 交叉校验：所有 pageRefs 存在于 `_index.json`、所有 layerId 存在、domain 数 ≥12。
标记共享任务完成，汇报：domain 数、layer 数、校验结果。
