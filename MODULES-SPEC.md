# 操练场「代码模块 + 代码版本」实施契约（给并行 agent）

> 本文件是**唯一契约**。所有 agent 只改自己名下的文件；接口、数据形状、目录布局、
> 校验命令都以本文件为准。发现契约有问题先在自己范围内做兼容处理，并在汇报里指出。

## 1. 目标

操练场不再是固定的一套 Cats 示例，而是「按学习路线练习模块组织」的代码库：

- **每个学习路线练习（30 个 item：s1-1 … s7-4）都有自己的默认代码**（可直接编译运行的 Nest 工程）；
  另有一个「自由沙盒 sandbox」模块，保留最初的 Cats 示例。
- 用户可编辑当前模块代码，**保存并命名**得到该模块的一个「代码版本」；**一个模块可有多份版本**。
- **重置**把当前模块恢复成它的默认代码。
- 通过**模块选择器**切换模块：工作区文件整体替换（停止运行中的应用），并带出该模块上次使用的版本代码。
- 切换模块 / 切换版本 / 重置 / 保存后重新加载，一律**先停止运行中的应用**。
- 学习路线视图里每个练习可以「去操练场练这个」，跳到操练场并选中对应模块。

## 2. 目录与存储布局（插件根 `/Users/lniev/ds-plugins/nest-assistant`）

```
playground-modules/<moduleId>/module.json        模块元数据（已由 scripts/seed-modules.mjs 生成）
playground-modules/<moduleId>/default/**         模块默认工程（可编译可运行）
playground-saves/<moduleId>/<snapshotId>/meta.json  保存的代码版本元数据
playground-saves/<moduleId>/<snapshotId>/files/**   版本文件（package.json、tsconfig.json、src/**）
playground-state.json                            当前选中模块/版本/脏标记（运行时生成，勿手写）
playground/                                      活动工作区（用户正在编辑的工程，运行时管理）
host/playground-template/                        最初 Cats 模板（sandbox 模块默认代码的来源，保持不动）
```

`moduleId` 形如 `s1-2` / `sandbox`，必须匹配 `^[a-z0-9][a-z0-9-]*$`。
`snapshotId` 由服务端生成：`s-<毫秒时间戳36进制>-<3位随机>`，不信任客户端。

`playground-state.json`（v1）：

```json
{
  "version": 1,
  "activeModuleId": "s1-2",
  "dirty": true,
  "versions": {
    "s1-2": { "kind": "snapshot", "snapshotId": "s-mf3k2-9ab", "name": "我的实现" },
    "s1-1": { "kind": "default" }
  },
  "updatedAt": 1730000000000
}
```

- `versions[moduleId]` 记录该模块「上次使用的版本」；切换回该模块时带出它。
- `dirty` 表示活动工作区自上次加载/保存后有修改（Host 在 writeFile/createEntry/deleteEntry 时置 true）。
- 状态文件缺失或损坏时视为 `{ activeModuleId: "sandbox", versions: {}, dirty: false }`，并保持工作区内容不动。

## 3. module.json 契约

由 `scripts/seed-modules.mjs` 生成，字段如下（**不要改 id/stageId 等元数据，只允许补 `summary` / `routes` / `defaultFile`**）：

```json
{
  "id": "s1-2",
  "itemId": "s1-2",
  "stageId": "s1",
  "stageIndex": 1,
  "itemIndex": 2,
  "stageTitleZh": "心智模型与最小可运行",
  "titleZh": "控制器与 REST 路由",
  "title": "控制器与 REST 路由",
  "level": "L1",
  "goal": "…", "practice": "…", "deliverable": "…", "accept": "…", "minutes": 150,
  "pageIds": ["controllers"],
  "summary": "这套默认代码练什么、有什么可改（中文，1-3 句，必填）",
  "defaultFile": "src/app.module.ts",
  "routes": [{ "method": "GET", "path": "/health", "expect": 200 }]
}
```

- `summary` 非空；`routes` 非空且**至少一条 `expect: 200`**，由 `scripts/verify-modules.mjs` 真实请求校验。
- `method` 省略默认 GET；POST/PUT/PATCH/DELETE 的路由由校验器自动发 `{}` 作为 body；
  路径里的 `:id` 会被替换成 `1`。`expect` 省略时只要求状态码在 1–499。
- `/health` 不是强制的，但**推荐**保留（返回 `{ "status": "ok", "module": "<id>" }`）。

## 4. 模块默认工程（default/）规范

每个模块的 `default/` 就是一套**真实 Nest CLI 脚手架形态**的工程：

```
default/package.json     真实脚手架字段（version/scripts/dependencies/devDependencies）
default/tsconfig.json    真实脚手架字段（outDir ./dist、decorator 元数据等）
default/tsconfig.build.json
default/nest-cli.json
default/.gitignore
default/.prettierrc
default/eslint.config.mjs
default/README.md        本练习的说明（模块标题、summary、practice、路由）
default/src/main.ts      真实入口：NestFactory.create -> 全局配置 -> app.listen(Number(process.env.PORT ?? 3000))
default/src/app.module.ts        必须导出 AppModule（运行时硬性要求）
default/src/**.ts                其余文件自由组织（推荐按 Nest 模块分目录）
```

旧版的 `src/bootstrap.ts`（`configureApp` 钩子）已废弃：全局配置直接写在 `src/main.ts` 的
`bootstrap()` 里（与 Nest CLI 生成的入口一致）。运行时仍兼容没有 `main.ts` 的旧工程（回落到
app.module.ts + bootstrap.ts），但新模块一律使用 `main.ts`。

操练场的运行时会：
- 加载项目自己的 `src/main.ts`（通过包装 `NestFactory.create` 捕获 App 实例），因此 `main.ts`
  里的全局前缀、管道、过滤器、拦截器、中间件写法就是真实项目写法；
- 给子进程设置 `PORT=0`（语法栈 `Number(process.env.PORT ?? 3000)` 会拿到随机端口，避免端口冲突）；
- 从监听地址推导请求 URL，并从 App 实例收集路由；
- 没有 `main.ts` 时回落到旧路径（app.module.ts + 可选 bootstrap.ts）。

### 4.1 硬性要求

1. **能编译**：TypeScript 严格模式关闭（`strict: false`），`experimentalDecorators` + `emitDecoratorMetadata`，CommonJS 输出。
2. **能启动**：`node scripts/verify-modules.mjs --only=<ids>` 必须 PASS（真实编译 + 启动 + 请求）。
3. **只能用已预装依赖**：`@nestjs/common` `@nestjs/core` `@nestjs/platform-express` `rxjs` `reflect-metadata` `typescript` 及其传递依赖（express、cors 等）。
   **不允许** `@nestjs/typeorm`、`@nestjs/swagger`、`@nestjs/jwt`、`@nestjs/config`、`@nestjs/cache-manager`、`@nestjs/bull`、`@nestjs/microservices`、`graphql`、`mongoose`、`class-validator`、`class-transformer` 等未安装包。
   需要演示这些主题时，用**内存实现 + 手写拦截器/守卫/管道/自定义装饰器**等价表达，并在注释里说明「真实项目会换成 X」。
4. **不联网**：不得发起真实网络请求、不得读环境变量里的密钥。
5. **端口/前缀**：不要写死端口（runner 自己 listen(0)）；建议 `bootstrap.ts` 里只 `app.enableCors({ origin: true })`。
   如果演示全局前缀，必须把前缀写进 `module.json.routes`（例如 `/api/health`）。
6. **不写 build/、不写 runner.cjs、不写 node_modules/**。
7. **代码风格**：TypeScript、官方 Nest 风格、2 空格缩进、单引号、分号；注释用中文，说明「练什么、改哪里」。
8. **文件规模**：每个模块 3–8 个文件，单文件不超过 ~200 行；不要为了凑文件而拆分。
9. 每个模块至少 2 条可请求路由（其中 ≥1 条 `expect: 200`），足够用户在请求台看到结果。

### 4.2 固定文件

`default/package.json`：

```json
{
  "name": "nest-playground",
  "private": true,
  "type": "commonjs"
}
```

`default/tsconfig.json`：

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmitOnError": true,
    "rootDir": ".",
    "outDir": "build"
  },
  "include": ["src/**/*.ts"]
}
```

### 4.3 参考实现

- 样板：`playground-modules/s1-1/`（Lead 已写好并通过校验）。
- 最小 Cats 示例：`playground-modules/sandbox/default/`。
- 学习路线里每个 item 的 `goal` / `practice` / `pageIds` 在
  `knowledge/learning-route.json`，也在各自的 `module.json` 里（直接读 json 即可）。

## 5. Host 运行时新增能力（host/playground-runtime.js）

在现有 `createPlaygroundRuntime(options)` 返回对象上新增两个方法（**其余方法不动**）：

```js
async replaceFrom(sourceDir)   // 用 sourceDir 的工程内容整体替换工作区
  // - sourceDir 必须是存在的目录，否则 throw Error('模板目录不存在：<dir>')
  // - 停止？否（由调用方先 stop()）；清掉 rootDir/src、rootDir/build、rootDir/runner.cjs
  // - 递归复制 sourceDir 内容到 rootDir，跳过 node_modules、build、runner.cjs、.git、.DS_Store
  // - 返回 { ok: true, files: [相对路径…] }
async captureTo(targetDir)      // 把工作区工程内容整体复制到 targetDir
  // - targetDir 为绝对路径；递归创建；复制前清空 targetDir（不存在则创建）
  // - 复制 rootDir 下除 node_modules、build、runner.cjs、.git、.DS_Store、*.tmp-* 之外的全部内容
  // - 返回 { ok: true, files: [相对路径…] }
```

`reset()` 保持现有语义（从 `templateDir` 恢复），可内部改为 `replaceFrom(templateDir)`。

## 6. 项目存储层（新文件 host/playground-projects.js）

```js
export function createProjectStore(options)
// options: { pluginRoot, rootDir, templateDir, modulesDir, savesDir, stateFile,
//            runtime,   // §5 的 runtime 实例（只用 replaceFrom / captureTo）
//            log?: (line: string) => void }
```

返回对象（全部 async，除 `dispose` 无）：

```js
{
  async ensure(): { ok, active }                 // 建目录/读状态/校验模块；不覆盖已有工作区文件
  async listModules(): { active, modules }       // modules: ModuleSummary[]
  async switchModule(moduleId): { active }       // 见下
  async loadVersion(kind, snapshotId?): { active } // kind: 'default' | 'snapshot'
  async saveSnapshot(name): { active, snapshot }  // 从当前工作区抓取
  async deleteSnapshot(snapshotId): { ok }        // 当前正在使用的版本禁止删除
  async resetActive(): { active }                 // 载入当前模块默认代码
  markDirty(): void                               // 工作区被修改后调用（写状态文件，best-effort）
  async status(): { active }
}
```

行为细节：

- `ensure()`：创建 `modulesDir` / `savesDir`；读 `stateFile`（缺失→默认 sandbox/default）；
  若 `rootDir/src/app.module.ts` 不存在 → 载入当前模块的目标版本（默认/保存版本），否则**不动**工作区。
- `switchModule(moduleId)`：
  1. 校验模块存在，否则 `throw new Error('未知模块：' + moduleId)`；
  2. 记住当前活动模块在 `versions` 里的选择；
  3. 目标版本 = `versions[moduleId]`（快照不存在则回落 default）→ `runtime.replaceFrom(目标目录)`；
  4. 更新 state（activeModuleId、dirty=false、updatedAt）并落盘；返回 `{ active }`。
- `loadVersion(kind, snapshotId)`：`default` → 模块默认目录；`snapshot` → 对应 files 目录（不存在→`throw Error('代码版本不存在')`）；
  `runtime.replaceFrom` 后 dirty=false，并写回 `versions[activeModuleId]`。
- `saveSnapshot(name)`：名称 trim 后 1–60 字符、不得含 `/` `\` 与控制字符、**同一模块内不得重名**；
  `snapshotId` 服务端生成；`runtime.captureTo(savesDir/<moduleId>/<snapshotId>/files)`；
  写 `meta.json`（`{ id, name, createdAt, updatedAt, fileCount }`）；当前版本指向该快照；dirty=false。
- `deleteSnapshot(snapshotId)`：在当前活动模块内查找；若等于当前使用中的快照 → `throw Error('当前正在使用该版本，先切换到其他版本')`；否则删目录，清了对应 `versions` 记录。
- `resetActive()`：`runtime.replaceFrom(模块默认目录)`；`versions[moduleId] = { kind: 'default' }`；dirty=false。
- **互斥**：所有会替换/保存工作区的操作（switchModule/loadVersion/saveSnapshot/deleteSnapshot/resetActive）在一个进程内串行执行（简单 promise 队列即可），防双击竞态。
- 所有抛错用中文；不得让异常打挂 Host。

`ModuleSummary`：

```json
{
  "id": "s1-2", "itemId": "s1-2", "stageId": "s1", "stageIndex": 1, "itemIndex": 2,
  "stageTitleZh": "心智模型与最小可运行",
  "titleZh": "控制器与 REST 路由", "title": "控制器与 REST 路由",
  "level": "L1", "summary": "…", "defaultFile": "src/app.module.ts",
  "snapshots": [{ "id": "s-…", "name": "我的实现", "createdAt": 173…, "updatedAt": 173…, "fileCount": 6 }]
}
```

`active`：

```json
{
  "moduleId": "s1-2",
  "moduleTitleZh": "控制器与 REST 路由",
  "stageId": "s1", "stageTitleZh": "心智模型与最小可运行",
  "defaultFile": "src/app.module.ts",
  "version": { "kind": "default" } | { "kind": "snapshot", "snapshotId": "s-…", "name": "我的实现" },
  "dirty": false
}
```

排序：模块按 `stageIndex`、`itemIndex` 升序（`sandbox` 的 stageIndex=0，排最前）。

## 7. HTTP API（index.js，前缀 `/nest-assistant/api`）

现有接口不变。**新增**（响应统一 `{ ok: true, ... }`；出错沿用现有 catch → 500 `{ ok: false, error }`）：

| 方法 | 路径 | 请求体 | 响应 |
| --- | --- | --- | --- |
| GET | `/playground/modules` | — | `{ ok, active, modules: ModuleSummary[] }` |
| POST | `/playground/module` | `{ moduleId }` | 先 `runtime.stop()`；`{ ok, active }` |
| POST | `/playground/version` | `{ kind: 'default'\|'snapshot', snapshotId? }` | 先 stop；`{ ok, active }` |
| POST | `/playground/snapshot` | `{ name }` | `{ ok, active, snapshot }` |
| DELETE | `/playground/snapshot` | `{ snapshotId }` | 先 stop？不需要；`{ ok }` |
| POST | `/playground/reset` | — | **新语义**：先 stop，恢复当前模块默认代码；`{ ok, active }` |

- `PUT /playground/file`、`POST/DELETE /playground/entry` 成功后调用 `store.markDirty()`。
- `POST /playground/module`、`/playground/version`、`/playground/reset`、`/playground/snapshot` 必须保证
  「切换/重置前先停止运行」：`await runtime.stop()`（无论之前是否在跑），并且返回后客户端会清空运行态。
- `GET /playground/modules` 不要求停止运行。
- 初始化：`apply()` 里创建 store，`ctx.effect` 注册 store 的 dispose（若有）；首个请求前 `store.ensure()` 一次（幂等）。

## 8. Client 视图契约（src/views/playground.js）

新增 props：`initialModuleId`（string|null）、`onInitialModuleConsumed`（fn）。

**模块栏**（位于右侧工具栏下方、跨 `.nep-right` 全宽，样式类前缀 `nep-mod-`）：

1. 模块 select（`ne-select`）：`<optgroup label={stageTitleZh}>` 分组，选项文本 `itemIndex. titleZh`（sandbox 除外，显示「自由沙盒（原始示例）」）。
   切换 → 若 `active.dirty` 先 `window.confirm(t('pg.dirtySwitchConfirm'))`；取消则恢复 select 显示原模块。
2. 版本 select：一项「默认代码」（value `default`）+ 每个快照（value `snapshotId`）。当前版本必须出现在列表里。
3. 按钮：保存并命名（`save` 图标）、重置为默认（`refresh` 图标）、删除当前版本（`trash` 图标，默认版本时禁用）。
4. 右侧/下方显示状态：`dirty ? t('pg.unsaved') : t('pg.savedState')`，以及当前模块的 `summary`（单行省略，title 显示全文）。

**切换/重置/加载/保存的时序（必须严格）**：

```
切换模块/版本、重置：
  1) 若 dirty → confirm；取消则终止
  2) POST /playground/stop（忽略错误）
  3) 清空客户端运行态：setRun(null)、stopPolling()、setResults(NEST_EMPTY)、setLogsOpen(false)、runRef 清理
  4) 调对应接口（module/version/reset）
  5) me.loadFiles()；重置 collapsed={}、selection=null、activePath=null、editorText/savedText=''
  6) 打开 active.defaultFile（不存在则打开第一个 .ts 文件）
  7) 刷新 GET /playground/modules，成功 toast
保存并命名：
  1) name = window.prompt(t('pg.snapshotNamePlaceholder'), 默认名如「我的实现」)；空则取消
  2) 若当前编辑文件 dirty → 先 PUT /playground/file 保存到磁盘
  3) POST /playground/snapshot { name }
  4) 刷新 modules，版本 select 选中新快照，toast
删除版本：confirm → DELETE /playground/snapshot { snapshotId } → 刷新 modules（默认版本时按钮禁用）
```

**埋点**：`props.initialModuleId` 非空且与 `active.moduleId` 不同时，走上面的「切换模块」流程（不 confirm，
因为来自学习路线跳转），完成后调用 `props.onInitialModuleConsumed()`。`initialModuleId` 变化时（useEffect 依赖它）重新处理。

**i18n**：所有新文案加在 `src/00-dicts.js` 的 zh/en 两份字典里，键前缀 `pg.`，例如：
`pg.module` `pg.moduleHint` `pg.version` `pg.versionDefault` `pg.saveSnapshot` `pg.snapshotName` `pg.snapshotNamePlaceholder`
`pg.resetToDefault` `pg.resetModuleConfirm` `pg.deleteSnapshot` `pg.deleteSnapshotConfirm` `pg.savedState` `pg.dirtySwitchConfirm`
`pg.switchedModule` `pg.switchedVersion` `pg.snapshotSaved` `pg.snapshotDeleted` `pg.noSnapshots` `pg.moduleLoading` `pg.fromRoute`。
（可增删，但必须 zh/en 双份、全部经 `t()`。）

**样式**：只能主题 token，禁止硬编码颜色；窄屏（<980px）时模块栏可换行；不得破坏现有布局。

## 9. 学习路线联动（src/panel.js + src/views/learning-route.js）

- panel：新增 `pendingModuleId` state；渲染 `NestPlaygroundView` 时传
  `initialModuleId: pendingModuleId` 与 `onInitialModuleConsumed: () => setPendingModuleId(null)`；
  渲染 `NestLearningRouteView` 时新增 prop `onOpenPlayground(item)`：
  `setPendingModuleId(item.id); setTab('playground');`。
- route view：每个 item 卡片（`NestRouteStage` 内的 item）新增按钮「去操练场练这个」→ `props.onOpenPlayground(item)`；
  若 `item.id` 不存在对应模块（当前 30 个都存在，sandbox 不在路线里）也照常跳，操练场会回落到原模块并 toast 提示。
  按钮样式复用 `ne-btn ne-btnSmall`；文案进该视图自己的 `NEST_I18N_ROUTE` 字典（zh/en 双份）。

## 10. 校验命令（所有 agent 只用这些，别写 client.js）

```bash
# 内容 agent：只验自己名下的模块
node scripts/verify-modules.mjs --only=s1-2,s1-3
node scripts/verify-modules.mjs --stage=s2
node scripts/verify-modules.mjs --list

# Host agent
node host/playground-projects.test.mjs
node host/playground-runtime.test.mjs      # 必须保持 PASS（原有能力不回归）
node scripts/test-host-api.mjs             # 必须保持通过（会真实启动 Nest 应用）

# Client / 集成 agent（不影响共享 client.js）
node build.mjs --out /tmp/<名字>-client.js
node scripts/smoke.mjs --bundle /tmp/<名字>-client.js
```

**禁止**：并行 agent 不要执行 `node build.mjs`（会覆盖共享 `client.js`）、不要动别人的文件、不要写 `playground/`（除测试脚本用临时目录）。
最终由 Lead 统一 `node build.mjs` 并跑全量验证。

## 10.5 脚手架升级（本轮）

`node scripts/upgrade-module-scaffold.mjs` 把每个模块的默认工程升级成真实 Nest CLI 形态：
把 `bootstrap.ts` 的 `configureApp` 内容搬进 `src/main.ts`、删除 `bootstrap.ts`、
补齐 `package.json` / `tsconfig.build.json` / `nest-cli.json` / `.gitignore` / `.prettierrc` /
`eslint.config.mjs` / `README.md`。可重复执行。执行后必须跑 `node scripts/verify-modules.mjs`。

## 11. 已知问题（上一轮文件树 review 的结论，本轮顺手修复）

这些是在现有 `src/views/playground.js` / `host/playground-runtime.js` 里真实存在的缺陷，由本轮对应 agent 一并修掉：

**client-agent（src/views/playground.js）**
1. HIGH：`deleteSelection` 没做路径保护，能删 `src` 本体与根配置（`package.json`/`tsconfig.json`）。修复：只允许删除 `src/` 下的条目（`target === 'src'`、根文件一律拒绝/禁用删除按钮）。
2. HIGH：新建表单预填 `parent + '/'`，什么都不输入直接 Enter 会把父目录本身当成新条目提交（`'src/'` 规范化成 `'src'`）。修复：把 parent 存进 creating state，提交时若 `normalized === parent` → 提示「请填写名称」，删掉 `normalized !== 'src'` 特例。
3. MED：创建已存在的文件夹会「假成功」、重复文件只抛 Host 原生错误。修复：提交前用现有 `files`/`dirs` 预检并给本地化提示。
4. MED：删除当前文件后编辑器切到 `list[0]`（排序后是 `package.json`）。修复：抽一个「优先文件」helper（`defaultFile` → 第一个 `.ts` → 第一个文件），boot/reset/删除/module 切换共用。
5. MED：`正在读取沙箱文件…` 与真正的空状态靠数据长度猜。修复：给 `NestPgFileTree` 传 `loading` 属性，空列表且非 loading 才显示 `pg.noFiles`。
6. LOW：点文件夹同时「选中 + 折叠」，折叠动作会让删除目标悄悄变成该文件夹。修复：twisty 只负责展开/折叠，点行只选中；或删除按钮只对选中且带明确指示的条目生效。
7. LOW：路径校验细节——`/src/x` 被静默接受、未 trim、`kind=file` 允许结尾 `/`。修复：`trim()`；显式拒绝以 `/` 或盘符开头；kind=file 时拒绝结尾 `/`。
8. LOW：`resetSandbox` 没清 `creating`/`selection`/`collapsed`。修复：重置时一起清空。
9. LOW：创建时若「不打开新文件」则新文件未被选中，且缺 in-flight 防抖（双击/双 Enter 会重复 POST）。修复：未打开时仍选中它；保存中禁用提交按钮。
10. NIT：没有子项的空目录仍显示展开箭头（可选修）。

**host-agent（host/playground-runtime.js）**
11. MED：`listFiles()` 内部调用 `ensureInternal()`，`src/app.module.ts` 不存在时会重抄模板 → 删除文件后文件"复活"。修复：`listFiles` 只读，不再做模板自愈（自愈只发生在 `ensure`/`start`/`reset`）。
12. HIGH：`deleteEntry` 的保护名单不全。修复：拒绝删除 `src` 本体、`package.json`、`tsconfig.json`、`build`、`runner.cjs` 以及 `src/` 之外的路径。
13. NIT：`listFiles` 的 walk 没有跳过 `src/node_modules`、`src/build`（手工创建的目录会灌进树）。修复：跳过这两个名字。

**route-agent / client-agent 共同注意**：新增模块栏后，上述交互仍要成立（切换模块会替换全部文件，删除保护仍按本节执行）。

## 12. 文件归属（写权限）

| 范围 | 归属 |
| --- | --- |
| `playground-modules/s1-2 … s2-3` | content-A |
| `playground-modules/s2-4 … s3-4` | content-B |
| `playground-modules/s4-1 … s5-4` | content-C |
| `playground-modules/s6-1 … s7-4` | content-D |
| `playground-modules/s1-1`, `sandbox`, `scripts/*`, `MODULES-SPEC.md`, `README.md`, `package.json`, `build.mjs` | Lead |
| `host/playground-runtime.js`, `host/playground-projects.js`, `host/playground-projects.test.mjs`, `index.js`, `scripts/test-host-api.mjs` | host-agent |
| `src/views/playground.js`, `src/styles/playground.js`, `src/00-dicts.js`（pg.* 键）, `scripts/smoke.mjs` | client-agent |
| `src/panel.js`, `src/views/learning-route.js` | route-agent |

每个 agent 只允许补自己模块 `module.json` 的 `summary` / `routes` / `defaultFile`，不得改其它字段。

## 13. 验收标准

- content-X：`node scripts/verify-modules.mjs --only=<自己全部模块>` 输出 `PASS`，且每个模块 `summary`/`routes` 已填。
- host-agent：store 单测 + 原有 runtime 测试 + host API 测试全绿；新增接口按 §7 工作（含「切换前停止」）。
- client-agent：`--bundle` 冒烟 69+/通过；新增组件/字典键齐备；切换逻辑满足 §8。
- route-agent：`--bundle` 冒烟通过；路线 item 按钮跳转后操练场选中对应模块（代码层面 props 打通即可）。
- Lead：全量 `node build.mjs` + 三套测试 + `node scripts/verify-modules.mjs` 全 PASS。

## 14. 实现状态（已交付）

- 31 个模块全部完成并通过 `node scripts/verify-modules.mjs`（31/31 PASS，真实编译 + 启动 + 请求）。
- Host：`replaceFrom` / `captureTo`、`host/playground-projects.js`、6 条 API 全部落地；
  `host/playground-runtime.test.mjs`、`host/playground-projects.test.mjs`、`scripts/test-host-api.mjs`（65/65，含「切换前停止运行」）全绿。
- Client：代码模块栏、版本保存/切换/删除、重置、`initialModuleId` 跳转完成；`scripts/smoke.mjs` 93/93。
- 学习路线联动：每个练习卡片「去操练场练这个」→ 操练场选中对应模块。
- 运行时生成物：`playground-state.json`、`playground-saves/`（可删，删后回到 sandbox 默认状态）。

### 新增模块的最小步骤

1. `node scripts/seed-modules.mjs`（或在 `playground-modules/<id>/module.json` 手写元数据）；
2. 写 `playground-modules/<id>/default/`（§4 规范）；
3. 填 `module.json` 的 `summary` / `routes` / `defaultFile`；
4. `node scripts/verify-modules.mjs --only=<id>` 必须 PASS。
