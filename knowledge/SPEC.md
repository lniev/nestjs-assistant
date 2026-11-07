# NestJS 官方文档知识库 — 内容生成规范（给内容 agent）

## 目标
把 NestJS 官方文档（https://docs.nestjs.com ，仓库 github.com/nestjs/docs.nestjs.com 的 `content/` 目录，
共 165 个 Markdown 页面）**逐页**总结成结构化中文知识条目，作为 DSH「NestJS 助手」插件的内置知识库。
用户要求：**官方文档每个内容都要有**，不能漏页。

## 权威清单与源文件位置
- 页面清单：`/Users/lniev/ds-plugins/nest-assistant/knowledge/_index.json`
  - `chapters[].items[]` 给出版块结构；`pages[]` 给出每页 `id / source / title / chapter / bytes`。
  - **page id 以 `_index.json` 为准，禁止自造或改动。**
- 官方 Markdown 源文件（本地已下载，直接 read，不要联网）：
  `/tmp/docs-repo/docs.nestjs.com-master/content/<source>`
  例如 source 为 `fundamentals/dynamic-modules.md`，就读
  `/tmp/docs-repo/docs.nestjs.com-master/content/fundamentals/dynamic-modules.md`。
- 分的任务清单：`knowledge/_assignments.json` 中你负责的 agent key 对应的 `pages[]`。

## 输出
- 写到 `knowledge/parts/<你的 agent key>-<序号>.json`，每个文件是**一个 JSON 数组**，
  **每个文件最多 6 个页面对象**；你的所有文件合起来必须**恰好覆盖分配给你的全部页面，每页一次**。
  例：`docs7-1.json`、`docs7-2.json`、`docs7-3.json`。
- 纯 JSON，UTF-8，无注释、无尾逗号。用 write 工具写入。
- 每写完一个文件，用 `node -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"` 校验一次。
- 最后自检：页数 = 分配数；id 无重复；每个 id 在 `_index.json` 中存在。
- 只写你名下的 `knowledge/parts/` 文件，**不改** `_index.json`、其他 agent 的文件、插件源码。

## 页面对象 schema（字段全部必填，除非标注可选）

```json
{
  "id": "fundamentals/dynamic-modules",
  "titleZh": "动态模块",
  "summary": "2-4 句中文总结（120-260 字）：这一章解决什么问题、核心机制是什么、典型使用场景。",
  "sections": [
    { "heading": "小节标题（4-14 字，中文）", "text": "该小节 2-4 句深入说明（80-180 字），讲清机制、用法或流程。" }
  ],
  "keyPoints": [
    "要点一（18-55 字，必须点出关键 API / 类名 / 装饰器，例如 @Module()、useFactory、forRootAsync）"
  ],
  "snippets": [
    { "title": "片段说明（中文，6-20 字）", "lang": "typescript", "code": "精简、可读、官方风格的代码，10-30 行" }
  ],
  "api": ["@Module()", "DynamicModule", "forRootAsync()"],
  "pitfalls": ["常见坑或误区（20-60 字）"],
  "enterprise": "1-2 句企业级项目落地建议（50-120 字）：什么时候用、怎么组织、和什么配合。",
  "related": ["controllers", "fundamentals/custom-providers"]
}
```

字段要求：
- `sections`：2-4 个，覆盖该页最核心的小节（不要照抄官方目录，要提炼）。
- `keyPoints`：5-7 条。
- `snippets`：1-2 个（页面是纯概念/清单类可 1 个或省略为 `[]`，但 `snippets` 字段必须存在）。
  `lang` 用 `typescript` / `bash` / `json` / `graphql` / `yaml` 之一；代码要**精简自官方示例**，能独立看懂，不要整段搬运超长示例。
- `api`：0-10 个，本章涉及的最重要 API / 装饰器 / 类名（英文原样）。
- `pitfalls`：2-3 条。
- `related`：0-4 个其它页面的 id（必须存在于 `_index.json`），挑选真正相关的章节；没有就 `[]`。

## 内容质量
- 全部正文用**简体中文**；API 名、装饰器、类名、包名保留英文（如 `@Injectable()`、`ModuleRef`、`@nestjs/microservices`）。
- **只依据官方原文**，不编造不存在的 API；官方页里出现的新特性（MCP、AI、Observability、Reliability 等）按原文如实总结。
- 有的页面是索引/清单/迁移指南（如 `cli/usages`、`migration`、`discover/who-uses`、`faq/errors`）：
  `keyPoints` 用条目化方式承载命令、错误名、迁移要点；`sections` 讲清"怎么用/怎么查"。
- 术语统一：依赖注入、提供者（provider）、模块、守卫（guard）、拦截器（interceptor）、管道（pipe）、
  异常过滤器（exception filter）、中间件（middleware）、传输器（transporter）。
- 不要写"本文介绍…"这类空话，直接给信息。summary 要能单独当卡片摘要读。
- `titleZh`：该页标题的中文译名（页面标题本身是专有名词时保留英文，如 "GraphQL"、"MCP"）。

## 完成后
1. 用 node 脚本统计你所有文件的总页数与 id 列表，确认与分配一致。
2. 把共享任务标记完成，汇报：agent key、文件列表、总页数、任何存疑页面。
