# 虚拟 NestJS 运行环境 — Host 模块实现规范（给 runtime agent）

## 目标
实现插件的「操练场」后端：一个**真实 NestJS 11 运行时**，由插件 Host 半管理。
用户在前端编辑 TS 文件 → 插件用 TypeScript 编译 → 用真实 Node 启动 Nest 应用 → 通过 HTTP 调用接口 → 返回结果。
所有依赖已预装在插件目录（`nest-assistant/node_modules`：@nestjs/common、@nestjs/core、
@nestjs/platform-express、rxjs、reflect-metadata、typescript），**不需要联网安装**。

## 你的交付物（只写这些文件）
1. `host/playground-runtime.js` — ES module（`export function createPlaygroundRuntime(options)`），只用 Node 内置模块。
2. `host/playground-template/` — 初始示例工程模板（runtime 首次初始化时复制到 playground 根目录）：
   - `package.json`（`{"name":"nest-playground","private":true,"type":"commonjs"}`）
   - `tsconfig.json`（参考用）
   - `src/app.module.ts`、`src/bootstrap.ts`、`src/cats/cats.module.ts`、
     `src/cats/cats.service.ts`、`src/cats/cats.controller.ts`
   - 官方风格、可编译、可运行；示例用内存数组实现 GET /cats、GET /cats/:id、POST /cats。
3. `host/playground-runtime.test.mjs` — 一个**可独立运行的验证脚本**：创建临时 playground 目录，
   加载 runtime，初始化、启动、请求一个接口、停止，打印 PASS/FAIL。（用 `node` 跑通。）

不要修改其它任何文件（package.json / index.js / src 下的内容由 Lead 负责）。

## 入口约定（2026-11 更新）

- 优先加载 `build/src/main.js`：**项目自己的 `src/main.ts`** 就是真实的 Nest 入口
  （`NestFactory.create(AppModule)` → 全局配置 → `app.listen(Number(process.env.PORT ?? 3000))`）。
  runner 会在 require `main.js` 之前包装 `NestFactory.create` 捕获 App 实例，然后轮询
  `app.getHttpServer().listening` 等待监听完成，最后从监听地址推导 URL、从 App 收集路由。
- 子进程环境固定 `PORT=0`（OS 分配随机端口），因此模板必须写 `Number(process.env.PORT ?? 3000)`。
- 找不到 `main.ts` 时回落到旧路径：`app.module.ts` + 可选 `bootstrap.ts(configureApp)`。
- 操练场没有 `@types/node`：编译程序通过 `typeRoots` 注入
  `host/playground-types/@types/playground-node`（最小 `process` 声明），该文件不会出现在用户项目里。

## 运行环境事实
- 插件根目录：`/Users/lniev/ds-plugins/nest-assistant/`（`import.meta.url` 可定位）。
- playground 根目录由调用方传入（默认 `<插件根>/playground`），runtime 自己创建目录、复制模板。
- `node_modules` 在**插件根目录**（`<插件根>/node_modules`），playground 是其子目录，
  Node 解析规则会向上找到，所以模板里的 `require('@nestjs/core')` 可用。
- 宿主可执行 node 路径由调用方通过 `options.nodePath` 传入（不要自己猜）。
- Node 版本 22/24，CommonJS 输出。
- `typescript` 用 `createRequire(import.meta.url)` 加载：`const require = createRequire(import.meta.url); const ts = require('typescript')`。

## 接口契约（必须严格实现）
```js
export function createPlaygroundRuntime(options)
// options: {
//   rootDir: string,          // playground 根目录（绝对路径；不存在则创建并复制模板）
//   templateDir: string,      // 模板目录（绝对路径；= host/playground-template）
//   nodePath: string,         // node 可执行文件绝对路径
//   log?: (line: string) => void
// }
// 返回对象（所有方法 async，除 dispose）：
{
  async ensure(): { ok, rootDir, initialized, depsOk, missingDeps: [] },  // 确保目录/模板/依赖可用
  async status(): { rootDir, nodePath, ready, depsOk, missingDeps, activeRunId, activeStatus },
  async listFiles(): { files: [ { path, size, mtime } ], dirs: [ { path } ] },
      // 相对 rootDir，包含 src/** 与项目根目录的脚手架文件（package.json/tsconfig*.json/
      // nest-cli.json/README/点文件 等）；排除 build/、node_modules、runner.cjs、*.tmp-*
      // dirs 为 src/ 下的全部目录（含空目录），供前端渲染缩进树
  async readFile(relPath): { path, content },
  async writeFile(relPath, content): { path, size },
  async createEntry(relPath, kind): { path },        // kind: 'file' | 'dir'
  async deleteEntry(relPath): { path },
  async reset(): { ok, files: [path] },              // 清空 src/ 和 build/、runner.cjs，重新复制模板
  async replaceFrom(sourceDir): { ok, files: [path] }, // 用 sourceDir 的工程整体替换工作区（跳过 node_modules/build/runner.cjs/.git）
  async captureTo(targetDir): { ok, files: [path] },   // 把工作区工程内容复制到 targetDir（先清空 targetDir）
  async start(): { runId },                          // 同步返回 runId；后台执行编译+启动；同一时刻仅一个 run
  async poll(runId): { runId, status, logs, routes, url, error, startedAt, endedAt },
      // status: 'compiling' | 'starting' | 'running' | 'failed' | 'stopped'
      // logs: string[]（最近 ≤200 行，含编译错误/应用 stdout/stderr，带级别前缀如 '[stderr] '）
      // routes: [{ method: 'GET', path: '/cats' }]（从 Express 路由表提取；含全局前缀时 path 也要含前缀）
  async request(runId, req): { status, statusText, headers: {..}, body, timeMs },
      // req: { method, path, headers?, body? }；body 为字符串（JSON 文本）；timeout 10s；错误返回 status:0 + error
  async stop(runId?): { ok },
  dispose(): void                                     // 停子进程（插件卸载时调用）
}
```
运行状态用内存 Map 保存 `runId -> run`；`poll` 返回运行对象的快照（不要返回内部引用）。
参数校验：路径必须相对、不得越界（`..` 拒绝）；写文件大小上限 512KB；日志缓冲上限 200 行 / 64KB。

## 实现要点
- **编译**：`ts.createProgram(srcFiles, compilerOptions)`，options:
  `{ module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
     emitDecoratorMetadata: true, esModuleInterop: true, skipLibCheck: true, strict: false,
     noEmitOnError: true, rootDir: <rootDir>, outDir: <rootDir>/build, moduleResolution: ts.ModuleResolutionKind.Node10 }`。
  把诊断格式化成 `path(line,col): error TSxxxx: message` 放进 logs；有错误则 status='failed'、
  error='TypeScript 编译失败'，不启动。
- **runner.cjs**（每次 start 重写）：
  ```js
  require('reflect-metadata');
  const path = require('node:path');
  const { NestFactory } = require('@nestjs/core');
  (async () => {
    const appModule = require(path.join(__dirname, 'build', 'src', 'app.module.js'));
    const AppModule = appModule.AppModule || appModule.default;
    if (!AppModule) throw new Error('src/app.module.ts 必须导出 AppModule');
    const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'], abortOnError: false });
    try {
      const boot = require(path.join(__dirname, 'build', 'src', 'bootstrap.js'));
      const configure = boot.configureApp || boot.default;
      if (typeof configure === 'function') await configure(app);
    } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    const routes = [];
    try {
      const instance = app.getHttpAdapter().getInstance();
      const stack = instance._router ? instance._router.stack : [];
      for (const layer of stack) {
        if (!layer.route) continue;
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        for (const method of methods) routes.push({ method, path: layer.route.path });
      }
    } catch {}
    console.log('##NEST_READY##' + JSON.stringify({ url, routes }));
    process.on('SIGTERM', () => app.close().finally(() => process.exit(0)));
  })().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });
  ```
  在 runner 中补全：全局前缀（`app.setGlobalPrefix('api')` 之类由 bootstrap 管，路由发现要取最终 path；
  如果发现路由 path 不含前缀，可在 runner 里读 `app.getHttpAdapter().getInstance()._router` 已含 prefix；
  接受一个简单实现即可，但要贴近真实）。
- **spawn**：`spawn(nodePath, ['runner.cjs'], { cwd: rootDir, env: cleanEnv, stdio: ['ignore','pipe','pipe'] })`；
  env 至少保留 `PATH`、`HOME`、`TMPDIR`，可加 `NODE_ENV=development`。stdout/stderr 按行收集到 logs。
  启动超时 30s → kill → failed('启动超时（30s）')；退出码非 0 且未 READY → failed，error 取 logs 尾部。
  READY 之后进程退出 → status='stopped'。
- **request**：用全局 `fetch`，`url + path`（path 以 / 开头），JSON body 原样发送，
  返回 `{ status, statusText, headers: Object.fromEntries(res.headers), body: text（截断 200KB）, timeMs }`；
  网络错误返回 `{ status: 0, error: message, timeMs }`。
- **reset()**：读取 templateDir 下所有文件（递归），清掉 rootDir/src、rootDir/build、rootDir/runner.cjs，
  再复制模板；不要动 node_modules。
- **replaceFrom(sourceDir)**：等价于 reset() 的清理 + 复制，但源目录由调用方指定（供「代码模块」切换）；
   源目录不存在时报中文错误。
- **captureTo(targetDir)**：把工作区工程（package.json、tsconfig.json、src/**）复制到 targetDir，
   排除 node_modules、build、runner.cjs、.git、.DS_Store、`*.tmp-*`；供保存代码版本使用。
- **listFiles() 只读**：不要在 listFiles 里重抄模板（否则删掉 src/app.module.ts 后文件会"复活"）；
   模板自愈只发生在 ensure()/start()/reset()。遍历时跳过 `src/node_modules`、`src/build`。
- **deleteEntry() 保护名单**：拒绝删除 `src` 本体、`package.json`、`tsconfig.json`、`build`、`runner.cjs`，
   以及 `src/` 之外的路径。
- **ensure()**：rootDir 不存在则创建；`src/app.module.ts` 不存在则从模板复制；deps 检查
  `require.resolve('@nestjs/core')`（以插件根为解析基准，runtime 文件在 `<根>/host/`，`createRequire(import.meta.url)` 可向上找到 `<根>/node_modules`）。
- 所有 public 方法里的异常要转换成 `{ ok:false, error }` 或抛出中文 Error；不要让一个请求打挂 Host 进程。
- `dispose()` 必须 kill 子进程（SIGTERM 后 2s SIGKILL）并清掉引用。
- 不要引入任何外部依赖；不要用 shell 字符串命令执行。

## 验证
- `node host/playground-runtime.test.mjs` 必须 PASS（该脚本自己创建临时目录，跑完清理）。
- 在插件根运行 `node --check host/playground-runtime.js` 做语法检查（ESM 语法用 `node --check` 可）。
- 另外把 `host/playground-template` 里的 TS 用 `typescript` 编译验证一遍（test 脚本覆盖即可）。

## 环境提示
- 测试用 node：系统 `node`（v22.22.2）；也可用 `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node`（v24.21.0）。
- 不要联网、不要安装 npm 包（已装好）。若发现缺包，报告 Lead。
- 完成后把共享任务标记完成，汇报：文件列表、test 输出、接口与 spec 的差异。
