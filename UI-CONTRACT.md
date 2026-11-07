# NestJS 助手插件 — 前端视图契约（给 UI agent）

你写的是 DSH Web UI 插件 **Client 半**的一部分。Client 半是一个**单文件浏览器脚本**
（`client.js`，由 `build.mjs` 把 `src/` 下多个**纯脚本片段**按固定顺序拼接生成）。
它不是 ES module：**不能出现 `import` / `export` / `require` / 顶层 `window.__ModuleLoader__`**。
拼接后的整体是一个工厂函数体，作用域里已有以下全局：

- `React` — host 提供的 React 18 运行时（`React.createElement` 等）。
- `h` — `React.createElement` 的别名。
- 其它文件里定义的函数/常量（按 build 顺序可见，函数声明会提升）。
- 你文件里定义的顶层 `const`/`function` 都会被后续文件（`panel.js`、`apply.js`）使用。

## 硬性约束
1. 只改你名下的文件（每个 agent 有自己的视图 + 样式文件），不要改其他文件。
2. 不要读取/修改 DOM，不要 portal 到 document.body，不要 `document.querySelector`。
3. 样式**只能用宿主主题 token**（CSS 变量）：`--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1`、
   `--dsw-alias-bg-layer-2`、`--dsw-alias-bg-overlay`、`--dsw-alias-border-l1`、`--dsw-alias-border-l2`、
   `--dsw-alias-brand-primary`、`--dsw-alias-label-primary`、`--dsw-alias-label-secondary`、
   `--dsw-alias-state-error-primary`、`--dsw-alias-state-warn-primary`、`--dsw-alias-state-success-primary`、
   `--dsw-alias-state-idle-primary`。禁止写死颜色（`#fff`、`rgba()` 不允许，透明请用 `color-mix` 或 opacity）。
4. 每个视图组件在自己的根节点里渲染 `<style>{CSS 常量}</style>`，组件卸载时自动清理。
   一个 agent 的 CSS 都放进自己那个样式文件的一个常量里。
5. 中文界面（`t` 字典 zk 为主）。所有可见文案都走 `t('xxx')`，不要硬编码中文/英文。
6. 组件必须是**纯函数组件**，不用 class，不用 JSX（用 `h()`）。事件用 React 合成事件写法。
7. 不使用第三方库、不联网、不读 localStorage（进度状态由 panel 传入/回调）。
8. 照顾好空状态、加载态（由 panel 控制）、窄屏（< 900px）堆叠布局。
9. 每个视图文件里同时导出一个字典对象：
   ```js
   const NEST_I18N_<VIEW> = { zh: { 'xx.yy': '…' }, en: { 'xx.yy': '…' } };
   ```
   键按视图前缀命名：knowledge 用 `kb.*`，企业地图用 `map.*`，学习路线用 `route.*`。
   `apply.js` 会把它们与基础字典合并成 `t`。
10. 变量/函数命名加前缀避免冲突：knowledge `nestKb*` / `NestKnowledgeView`，map `nestMap*` / `NestEnterpriseMapView`，
    route `nestRoute*` / `NestLearningRouteView`。

## 可用的共享辅助（`src/01-utils.js` / `src/02-glyphs.js` / `src/03-chat.js` 提供，已存在于作用域）
- `nestErrorMessage(error)` → string
- `nestReadStore(key, fallback)` / `nestWriteStore(key, value)`（由 panel 用；视图一般不用）
- `nestFetchJson(path, options)` → Promise<json>；自动拼 `/nest-assistant/api` 前缀并解包错误（视图里请**不要**自己发请求，数据由 panel 注入）
- `nestRenderRichText(text)` → React 节点数组：支持 `**粗体**`、`` `行内代码` ``、``` 围栏代码块、标题、列表、引用、段落
- `nestRenderInline(text, keyPrefix)` → React 节点数组（单行内联富文本）
- `nestClipText(text, limit)` → string
- `nestFormatMinutes(n)` → string
- `nestGlyph(props)` → SVG 图标组件，`props.name` 可选：
  `'search' 'book' 'map' 'route' 'play' 'send' 'refresh' 'chevron' 'folder' 'file' 'code' 'check'
   'alert' 'info' 'external' 'stop' 'terminal' 'spark' 'layers' 'arrowLeft' 'arrowRight' 'plus' 'trash' 'save' 'copy' 'clock'`
- 基础通用 class（`src/styles/base.js` 已定义）：`.ne-btn` `.ne-btnPrimary` `.ne-btnGhost` `.ne-btnSmall`
  `.ne-chip` `.ne-chipSoft` `.ne-scroll` `.ne-empty` `.ne-spinner` `.ne-linkBtn` `.ne-sectionTitle` `.ne-muted`
  （可直接用，也可在自己的 CSS 里补充视图专属样式。）
- `nestRenderPageLink(pageId, label, onOpen)` 可用（可选）。

### 4) playground — `src/views/playground.js`（本轮大改）

除原有 props 外追加 `initialModuleId`（string|null）与 `onInitialModuleConsumed`（fn）；
新增「代码模块」栏（模块选择、代码版本选择、保存并命名、重置为默认、删除版本）。
接口形状、切换时序与 i18n 键见 `MODULES-SPEC.md` §7/§8。

## 数据形状（panel 注入 props）

### KB（`kb`，知识全貌）
```js
kb = {
  meta: { source: { repo, pageCount }, generatedAt, counts: { pages, chapters } },
  chapters: [
    { id: 'overview', title: 'Overview', titleZh: '概览',
      items: [ { id: 'first-steps', title: 'First steps', titleZh: '第一步' } ] }
  ],
  pages: {
    'first-steps': {
      id, path, title, titleZh, chapter, chapterTitle, group,
      summary, sections: [{heading,text}],
      keyPoints: [..], snippets: [{title,lang,code}], api: [..],
      pitfalls: [..], enterprise, related: [pageId..]
    }
  }
}
```
可用页面 id 列表：`kb.chapters[].items[].id`。

### 企业级开发知识地图（`map`）
```js
map = {
  titleZh, intro,
  layers: [ { id, titleZh, description } ],
  maturity: [ { level: 'L1', titleZh, description } ],
  domains: [ {
    id, titleZh, title, layerId,
    essential: '为什么企业级需要（中文）',
    practices: [ { title, detail, level: 'L1'|'L2'|'L3'|'L4', pageRefs: [pageId] } ],
    checklist: ['上线前检查项'],
    antiPatterns: ['反模式'],
    nestApi: ['@Module', 'APP_INTERCEPTOR']
  } ],
  projectTemplate: { summary, tree: ['src/modules/…'] }
}
```

### 学习路线（`route`）
```js
route = {
  titleZh, intro, totalHours,
  stages: [ {
    id, title, titleZh, weeks, goal, hours,
    items: [ {
      id, title, goal, points: [..], deliverable, accept, minutes,
      pageIds: [pageId], practice, level
    } ]
  } ],
  checkpoints: [ { title, description } ],
  tracks: [ { id, titleZh, description, stageIds: [..] } ]
}
```
`progress` 形如 `{ 's0-1': true }`，`onToggleItem(itemId)` 由 panel 持久化。

## 视图组件签名与 props（必须严格实现）

### 1) knowledge — `src/views/knowledge.js`
```js
function NestKnowledgeView(props)
// props: { t, kb, initialPageId, onAskAi(page, mode), onOpenPage(pageId) }
//   page = kb.pages[id]; mode = 'explain' | 'practice'
```
要求：
- 两栏：左侧目录树（章节可折叠、当前页高亮、顶部搜索框按 title/titleZh/summary/keyPoints 过滤），
  右侧内容区（标题区 + 官方链接 + summary + sections + 要点 + 代码块（带复制按钮）+ API chips + 常见坑 + 企业建议 + 相关页面）。
- 搜索命中时在目录里显示过滤结果，点击跳转；内容区跟随选中页。
- 标题区提供「问 AI 讲解」「去操练场」按钮 → `onAskAi(page,'explain')` / `onAskAi(page,'practice')`。
- 内容区可滚动；目录可滚动。窄屏时目录折叠为顶部横向章节选择 + 搜索。
- 初始选中 `initialPageId || 第一页`；`initialPageId` 变化时跟随切换（用 useEffect 同步）。

### 2) enterprise-map — `src/views/enterprise-map.js`
```js
function NestEnterpriseMapView(props)
// props: { t, map, onAskAi(domain), onOpenPage(pageId) }
```
要求：
- 顶部：标题 + intro + 成熟度 L1–L4 说明（可横向步骤条）。
- 主体：按 `layerId` 分层的领域卡片网格（每层一个区块，层标题+说明，领域卡片显示 icon/标题/essential/实践数/API 数）；
  点击领域 → 展开详情面板（右侧或卡片内展开）：practices（含 level badge 与可点击 pageRefs）、
  checklist、antiPatterns、nestApi chips、pageRefs 跳转、「让 AI 展开讲解」按钮。
- 底部：`projectTemplate` 推荐目录树（等宽字体展示）。
- 搜索/过滤可选（有更好）。

### 3) learning-route — `src/views/learning-route.js`

> 学习路线 → 操练场联动（本轮新增）：view props 追加 `onOpenPlayground(item)`，每个练习 item 卡片新增「去操练场练这个」
> 按钮调用它；`panel.js` 收到后 `setPendingModuleId(item.id); setTab('playground')`，并把 `initialModuleId` 传给
> 操练场视图。完整契约见 `MODULES-SPEC.md` §8/§9。
```js
function NestLearningRouteView(props)
// props: { t, route, progress, onToggleItem(itemId), onAskAi(item, mode), onOpenPage(pageId) }
```
要求：
- 顶部：总进度条（完成项/总项、小时数）+ 路线 track 选择（若有多个）。
- 主体：垂直时间线式阶段列表；每阶段显示序号、标题、周期、目标、进度；阶段内 item 卡片：
  勾选框（`onToggleItem`）、目标、points、交付物、验收标准、pageIds 链接、分钟数、level，
  「问 AI 练一练」→ `onAskAi(item,'practice')`。
- 展开/折叠阶段，默认展开第一阶段且当前进行中的阶段。
- 数据里没有 track 时隐藏 track UI。

## 参考实现
动笔前先读（同机已有、只读参考）：
- `/Users/lniev/sigo/desk/.dsh-plugins/dsh-pm-coach/src/dicts.js`（字典写法）
- `/Users/lniev/sigo/desk/.dsh-plugins/dsh-pm-coach/src/styles.js`（主题 token 用法）
- `/Users/lniev/sigo/desk/.dsh-plugins/dsh-pm-coach/src/panel.js`（h() 组件写法、结构）
不要改这些文件。

## 交付
- 写你名下的两个文件（view + style），`node --check` 无法单独检查片段（它不是完整文件），
  可以用 `node -e` 拼接一个 stub 检查语法（见 build.mjs 的拼装方式）或运行插件的 `scripts/smoke.mjs`。
- 完成后把共享任务标记完成，汇报文件名与组件/字典导出名。
