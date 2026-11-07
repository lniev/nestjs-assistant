# NestJS 学习路线 — 内容生成规范（给 route agent）

## 产物
`/Users/lniev/ds-plugins/nest-assistant/knowledge/learning-route.json`
单个 JSON 对象（UTF-8，无注释）。写完用 `node -e "JSON.parse(...)"` 校验。

## 定位
面向"想系统学会 NestJS、并能胜任企业后端开发"的学习者：分阶段路线，每项有目标、要点、
交付物、可自检的验收标准和预计时长；能勾选完成、能跳转知识库页面、能让 AI 陪练。

## 素材
- 页面清单（page id 引用必须存在）：`knowledge/_index.json`
- 官方原文（本地只读）：`/tmp/docs-repo/docs.nestjs.com-master/content/<source>`
  建议浏览：`first-steps.md`、`controllers.md`、`components.md`、`modules.md`、`middlewares.md`、
  `exception-filters.md`、`pipes.md`、`guards.md`、`interceptors.md`、`custom-decorators.md`、
  `fundamentals/*`、`application/*`、`security/*`、`data/*`、`http/*`、`observability/*`、
  `reliability/*`、`microservices/basics.md`、`recipes/cqrs.md`、`deployment.md`。
- 可参考同机已有实现风格（只读）：`/Users/lniev/sigo/desk/.dsh-plugins/dsh-pm-coach/src/content.js`
  （它的计划数据结构与写法，但不是 NestJS 内容）。

## Schema（严格按此结构，字段全部必填）

```json
{
  "titleZh": "NestJS 进阶学习路线",
  "intro": "2-3 句总述（100-180 字）：适合谁、学完能达到什么水平、怎么用这条路线。",
  "totalHours": 120,
  "tracks": [
    { "id": "backend", "titleZh": "后端开发主线", "description": "30-60 字", "stageIds": ["s1","s2","s3","s4","s5","s6"] },
    { "id": "fast", "titleZh": "有 Node 基础速通", "description": "30-60 字", "stageIds": ["s1","s3","s4","s6"] }
  ],
  "stages": [
    {
      "id": "s1",
      "title": "Stage 1 · 心智模型与最小可运行",
      "titleZh": "心智模型与最小可运行",
      "weeks": "第 1 周",
      "goal": "这一阶段的目标（40-80 字）",
      "hours": 10,
      "items": [
        {
          "id": "s1-1",
          "title": "读懂 Nest 的启动链路",
          "goal": "这一项要搞懂什么（40-80 字）",
          "points": ["关键要点 1（15-50 字）", "关键要点 2"],
          "deliverable": "可检查的产出物，如"一个能跑的 GET /cats 接口"（15-40 字）",
          "accept": "可自检的验收标准（15-50 字）",
          "minutes": 90,
          "level": "L1",
          "pageIds": ["first-steps", "controllers"],
          "practice": "在操练场怎么练的一句提示（30-70 字）"
        }
      ]
    }
  ],
  "checkpoints": [
    { "title": "阶段验收标题（6-18 字）", "description": "怎么验收（40-100 字）" }
  ]
}
```

## 覆盖要求
- stages 6-7 个，递进：环境与心智模型 → 请求生命周期（控制器/管道/守卫/拦截器/过滤器）→ 
  模块化与依赖注入进阶 → 数据与配置 → 认证授权与安全 → 工程化（测试/日志/可观测/部署）→ 
  企业级架构（可靠性/微服务/性能/团队规范）。
- 每阶段 4-6 个 items；全路线 28-36 项，`totalHours` 与各阶段 hours 大致自洽（可按 12 周 / 120h 规划，
  也可给 8 周速通线）。
- `pageIds` 每项 1-3 个，必须存在于 `_index.json`。
- `level` 取 L1-L4，表示该项达到的成熟度。
- `tracks` 至少 1 条（主路线），可再给 1 条速通线；若给多条，stageIds 必须存在。
- `checkpoints` 4-7 条，对应阶段完成后可做的验收（能交付什么、能回答什么）。

## 质量要求
- 简体中文；API/包名/命令英文原样；不要编造 Nest 不存在的功能。
- 每项都要"可执行、可验收"，拒绝"学习 XX 概念"这种空话；交付物要具体（接口/模块/测试/文档）。
- 总量 10-15KB JSON，**一次 write 写完**（约 7-10k tokens；请精简措辞）。

## 完成后
用 node 校验 JSON + 交叉校验：所有 pageIds 存在、所有 stageIds/track 引用存在、阶段数/项数达标。
标记共享任务完成，汇报：阶段数、items 数、tracks 数、校验结果。
