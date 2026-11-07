/**
 * Playground runtime for the NestJS Assistant plugin.
 *
 * The runtime owns a real NestJS project on disk: it copies a starter template,
 * compiles the user's TypeScript sources with the TypeScript compiler that ships
 * with the plugin, boots the resulting application with a real Node process and
 * proxies HTTP requests into it.
 *
 * Only Node.js built-in modules are imported here; TypeScript is loaded lazily
 * through `createRequire` so this module can always be imported (and missing
 * dependencies can be reported instead of crashing the Host).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
/** Ambient typing helpers injected into the compiler program. */
const HOST_ROOT = HOST_DIR;
const PLUGIN_ROOT = path.resolve(HOST_DIR, '..');
const DEFAULT_TEMPLATE_DIR = path.join(HOST_DIR, 'playground-template');
const DEFAULT_ROOT_DIR = path.join(PLUGIN_ROOT, 'playground');
const NODE_MODULES_DIR = path.join(PLUGIN_ROOT, 'node_modules');

const require = createRequire(import.meta.url);

const READY_MARKER = '##NEST_READY##';
const MAX_LOG_LINES = 200;
const MAX_LOG_BYTES = 64 * 1024;
const MAX_LOG_LINE_BYTES = 16 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_RESPONSE_BYTES = 200 * 1024;
const START_TIMEOUT_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;
const KILL_GRACE_MS = 2 * 1000;
const MAX_RUNS = 30;

/**
 * Names never copied out of a project (template -> workspace and workspace ->
 * snapshot): dependency trees, compile output and the generated runner are all
 * runtime artifacts, not user code.
 */
const PROJECT_SKIP_NAMES = new Set(['node_modules', 'build', 'runner.cjs', '.git', '.DS_Store']);

/** Paths that may never be deleted through the file API. */
const PROTECTED_DELETE_PATHS = new Set(['src', 'package.json', 'tsconfig.json', 'build', 'runner.cjs']);

/** Modules that must be resolvable for the playground to work. */
const REQUIRED_DEPENDENCIES = [
  'typescript',
  '@nestjs/core',
  '@nestjs/common',
  '@nestjs/platform-express',
  'reflect-metadata',
  'rxjs',
];

/** The CommonJS bootstrap written to `<rootDir>/runner.cjs` before every start. */
const RUNNER_SOURCE = `'use strict';
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const core = require('@nestjs/core');

const READY_MARKER = '##NEST_READY##';

function normalizeRoutePath(value) {
  let routePath = String(value === undefined || value === null ? '' : value);
  routePath = routePath.replace(/\\/+$/, '');
  if (routePath === '') routePath = '/';
  if (routePath.charAt(0) !== '/') routePath = '/' + routePath;
  return routePath;
}

function collectRoutes(app) {
  const routes = [];
  const seen = new Set();
  const add = (method, routePath) => {
    const normalized = normalizeRoutePath(routePath);
    const key = method + ' ' + normalized;
    if (seen.has(key)) return;
    seen.add(key);
    routes.push({ method: method, path: normalized });
  };
  const visit = (stack) => {
    if (!Array.isArray(stack)) return;
    for (const layer of stack) {
      if (!layer) continue;
      if (layer.route) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        const methods = layer.route.methods ? Object.keys(layer.route.methods) : [];
        for (const method of methods) {
          if (!/^[a-z]+$/.test(method)) continue;
          for (const routePath of paths) add(method.toUpperCase(), routePath);
        }
        continue;
      }
      // Express routers can be nested; Nest's Express adapter normally inlines
      // controller routes, but walking nested routers keeps this resilient.
      if (layer.handle && Array.isArray(layer.handle.stack)) visit(layer.handle.stack);
    }
  };
  try {
    const instance = app.getHttpAdapter().getInstance();
    const router = instance && (instance.router || instance._router);
    if (router && Array.isArray(router.stack)) visit(router.stack);
  } catch (error) {
    /* route discovery is best-effort and must never prevent startup */
  }
  return routes;
}

/**
 * Capture the application instance created by the project's own src/main.ts.
 *
 * Real Nest scaffolds start the app inside main.ts (NestFactory.create ->
 * app.listen). The runner needs that exact instance for route discovery and a
 * usable URL, so it wraps NestFactory.create and app.listen before main.ts is
 * loaded. The app still boots through the project's own main.ts code path.
 */
function installCaptor() {
  const state = { app: null, appResolve: null };
  state.appPromise = new Promise((resolve) => { state.appResolve = resolve; });
  const factory = core.NestFactory;
  const originalCreate = factory.create.bind(factory);
  factory.create = async function capturedCreate(...args) {
    const app = await originalCreate(...args);
    if (state.app === null) {
      state.app = app;
      state.appResolve(app);
    }
    return app;
  };
  return state;
}

function addressUrl(app) {
  try {
    const server = app.getHttpServer();
    const address = server && typeof server.address === 'function' ? server.address() : null;
    if (address !== null && typeof address === 'object' && typeof address.port === 'number') {
      return 'http://127.0.0.1:' + String(address.port);
    }
  } catch (error) {
    /* fall through to getUrl() */
  }
  return null;
}

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/** Poll the http server until main.ts has finished listening. */
async function waitForListening(app, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const server = app.getHttpServer();
      if (server && server.listening === true) return true;
    } catch (error) {
      /* not ready yet */
    }
    await delay(50);
  }
  return false;
}

/** Boot through src/main.ts (real Nest scaffold) and return the captured app. */
async function bootFromMain(state, mainPath) {
  require(mainPath);
  const booted = await Promise.race([state.appPromise.then(() => true), delay(60000).then(() => false)]);
  if (!booted) throw new Error('src/main.ts 没有启动应用（bootstrap() 必须调用 NestFactory.create）');
  const listening = await waitForListening(state.app, 15000);
  if (!listening) {
    /* main.ts created the app but never listened: start it ourselves on a free port. */
    await state.app.listen(0, '127.0.0.1');
  }
  return state.app;
}

async function bootFromModule() {
  const appModule = require(path.join(__dirname, 'build', 'src', 'app.module.js'));
  const AppModule = appModule.AppModule || appModule.default;
  if (!AppModule) throw new Error('src/app.module.ts 必须导出 AppModule');
  const app = await core.NestFactory.create(AppModule, { logger: ['error', 'warn'], abortOnError: false });
  const bootstrapPath = path.join(__dirname, 'build', 'src', 'bootstrap.js');
  if (fs.existsSync(bootstrapPath)) {
    const boot = require(bootstrapPath);
    const configure = boot.configureApp || boot.default;
    if (typeof configure === 'function') await configure(app);
  }
  await app.listen(0, '127.0.0.1');
  return app;
}

async function main() {
  const mainPath = path.join(__dirname, 'build', 'src', 'main.js');
  const hasMain = fs.existsSync(mainPath);
  const state = hasMain ? installCaptor() : null;
  const app = hasMain ? await bootFromMain(state, mainPath) : await bootFromModule();

  const url = addressUrl(app) || (await app.getUrl());
  const routes = collectRoutes(app);
  console.log(READY_MARKER + JSON.stringify({ url: String(url), routes: routes }));

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const force = setTimeout(() => process.exit(0), 1800);
    force.unref();
    Promise.resolve()
      .then(() => app.close())
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`;

// #region small helpers
/** Read one error's message. */
function errorMessage(error) {
  if (error === null || error === undefined) return '未知错误';
  if (typeof error.message === 'string' && error.message !== '') return error.message;
  return String(error);
}

/** Whether a filesystem entry exists (including broken symlinks). */
function pathExists(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch (_error) {
    return false;
  }
}

/** Whether a path is an existing directory. */
function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch (_error) {
    return false;
  }
}

/** Whether `child` is inside (or equal to) `parent`. */
function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

/** Convert a platform relative path to API form (forward slashes). */
function toPosix(relative) {
  return relative.split(path.sep).join('/');
}

/** Whether a directory entry name is a temporary file written by writeFile(). */
function isTemporaryName(name) {
  return name.indexOf('.tmp-') >= 0;
}

/**
 * Recursively copy one project tree into `targetDir`.
 *
 * `skipNames` drops runtime artifacts; `skipTmp` additionally drops half-written
 * temporary files. With `overwrite === false` existing target files win (used by
 * the template self-heal so user edits are never clobbered).
 *
 * @returns {string[]} copied file paths relative to the source root (posix form)
 */
function copyProjectTree(sourceDir, targetDir, options) {
  const settings = options === null || typeof options !== 'object' ? {} : options;
  const skipNames = settings.skipNames instanceof Set ? settings.skipNames : PROJECT_SKIP_NAMES;
  const skipTmp = settings.skipTmp === true;
  const overwrite = settings.overwrite !== false;
  const copied = [];
  const walk = (currentSource, currentTarget, relative) => {
    const entries = fs.readdirSync(currentSource, { withFileTypes: true });
    for (const entry of entries) {
      if (skipNames.has(entry.name)) continue;
      if (skipTmp && isTemporaryName(entry.name)) continue;
      const childRelative = relative === '' ? entry.name : relative + '/' + entry.name;
      const sourcePath = path.join(currentSource, entry.name);
      const targetPath = path.join(currentTarget, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        walk(sourcePath, targetPath, childRelative);
        continue;
      }
      // Symlinks and other non-regular entries are never copied: a project tree
      // must not be able to smuggle the plugin's node_modules into a snapshot.
      if (!entry.isFile()) continue;
      if (!overwrite && pathExists(targetPath)) continue;
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      copied.push(childRelative);
    }
  };
  walk(sourceDir, targetDir, '');
  copied.sort((left, right) => left.localeCompare(right));
  return copied;
}

/** Whether a path is an executable file. */
function isExecutableFile(target) {
  try {
    fs.accessSync(target, fs.constants.X_OK);
    return fs.statSync(target).isFile();
  } catch (_error) {
    return false;
  }
}

/** Resolve dependencies relative to the plugin root. */
function checkDependencies() {
  const missingDeps = [];
  for (const dependency of REQUIRED_DEPENDENCIES) {
    try {
      require.resolve(dependency);
    } catch (_error) {
      missingDeps.push(dependency);
    }
  }
  return { depsOk: missingDeps.length === 0, missingDeps };
}

/** TypeScript is loaded lazily so import failures surface as runtime errors. */
let typescriptModule = null;
let typescriptError = null;
function getTypeScript() {
  if (typescriptModule !== null) return typescriptModule;
  if (typescriptError !== null) throw new Error('无法加载 TypeScript 编译器：' + typescriptError);
  try {
    typescriptModule = require('typescript');
    return typescriptModule;
  } catch (error) {
    typescriptError = errorMessage(error);
    throw new Error('未找到 TypeScript 编译器（typescript），请检查插件依赖');
  }
}

/** Keep one log line bounded in bytes. */
function clipLogLine(line) {
  if (line.length <= MAX_LOG_LINE_BYTES) return line;
  const buffer = Buffer.from(line, 'utf8');
  if (buffer.length <= MAX_LOG_LINE_BYTES) return line;
  return buffer.subarray(0, MAX_LOG_LINE_BYTES).toString('utf8') + '…（已截断）';
}

/** Format one TypeScript diagnostic as `file(line,col): error TSxxxx: message`. */
function formatDiagnostic(ts, diagnostic, rootDir) {
  const category =
    diagnostic.category === ts.DiagnosticCategory.Error
      ? 'error'
      : diagnostic.category === ts.DiagnosticCategory.Warning
        ? 'warning'
        : 'info';
  const code = 'TS' + String(diagnostic.code);
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').trim();
  if (diagnostic.file && typeof diagnostic.start === 'number') {
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const filePath = toPosix(path.relative(rootDir, diagnostic.file.fileName));
    return filePath + '(' + String(position.line + 1) + ',' + String(position.character + 1) + '): ' + category + ' ' + code + ': ' + message;
  }
  return category + ' ' + code + ': ' + message;
}

// #endregion

/**
 * Create one playground runtime instance.
 *
 * @param {object} options
 * @param {string} [options.rootDir] Absolute playground directory.
 * @param {string} [options.templateDir] Absolute starter-template directory.
 * @param {string} [options.nodePath] Absolute Node.js executable.
 * @param {(line: string) => void} [options.log] Optional diagnostic sink.
 */
export function createPlaygroundRuntime(options = {}) {
  const rootDir = path.resolve(
    typeof options.rootDir === 'string' && options.rootDir.trim() !== '' ? options.rootDir : DEFAULT_ROOT_DIR,
  );
  const templateDir = path.resolve(
    typeof options.templateDir === 'string' && options.templateDir.trim() !== ''
      ? options.templateDir
      : DEFAULT_TEMPLATE_DIR,
  );
  const nodePath =
    typeof options.nodePath === 'string' && options.nodePath.trim() !== '' ? options.nodePath : process.execPath;
  const logSink = typeof options.log === 'function' ? options.log : null;

  /** @type {Map<string, object>} */
  const runs = new Map();
  /** @type {string | null} */
  let activeRunId = null;
  let disposed = false;
  let runCounter = 0;

  /** Best-effort plugin-level logging; never lets a bad log sink break the runtime. */
  function safeLog(message) {
    if (logSink === null) return;
    try {
      logSink(String(message));
    } catch (_error) {
      /* logging is best-effort */
    }
  }

  // #region paths
  /** Validate one API-supplied relative path and resolve it under rootDir. */
  function resolveRelativePath(input, action) {
    if (typeof input !== 'string') throw new Error('路径必须是字符串');
    const raw = input.trim();
    if (raw === '') throw new Error('路径不能为空');
    if (raw.includes('\0')) throw new Error('路径包含非法字符');
    const forward = raw.replace(/\\/g, '/');
    if (
      path.isAbsolute(raw) ||
      forward.startsWith('/') ||
      /^[A-Za-z]:\//.test(forward) ||
      forward.startsWith('//')
    ) {
      throw new Error('必须使用相对路径：' + raw);
    }
    const segments = forward.split('/');
    if (segments.some((segment) => segment === '..')) {
      throw new Error('路径不能包含 ".."：' + raw);
    }
    if (segments.some((segment) => segment === 'node_modules')) {
      throw new Error('不能访问 node_modules：' + raw);
    }
    const normalized = path.posix.normalize(forward);
    if (normalized === '.' || normalized === '' || normalized === '..' || normalized.startsWith('../')) {
      throw new Error('非法路径：' + raw);
    }
    const absolute = path.resolve(rootDir, normalized);
    if (absolute === rootDir || !isInside(rootDir, absolute)) {
      throw new Error('路径越界：' + raw);
    }
    if (action === 'delete') {
      if (PROTECTED_DELETE_PATHS.has(normalized)) {
        throw new Error('不允许删除受保护的路径：' + normalized);
      }
      if (normalized.startsWith('build/') || normalized.startsWith('runner.cjs/')) {
        throw new Error('不允许删除受保护的路径：' + normalized);
      }
      // Only src/** is deletable: the project root (package.json, tsconfig.json)
      // and runtime artifacts are owned by the playground, not by the editor.
      if (normalized.split('/')[0] !== 'src') {
        throw new Error('只允许删除 src 下的文件或目录：' + normalized);
      }
    }
    return { relative: normalized, absolute };
  }

  /** Ensure the dependency link for playgrounds outside the plugin root. */
  function ensureModuleLink() {
    if (isInside(PLUGIN_ROOT, rootDir)) return { created: false, ok: true };
    const linkPath = path.join(rootDir, 'node_modules');
    if (pathExists(linkPath)) return { created: false, ok: true };
    try {
      fs.symlinkSync(NODE_MODULES_DIR, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
      safeLog('linked playground dependencies: ' + linkPath + ' -> ' + NODE_MODULES_DIR);
      return { created: true, ok: true };
    } catch (error) {
      safeLog('could not link playground dependencies: ' + errorMessage(error));
      return { created: false, ok: false, error: errorMessage(error) };
    }
  }

  /** Recursively copy template files into the playground (never overwrites user edits). */
  function copyTemplate(sourceDir, targetDir, overwrite) {
    return copyProjectTree(sourceDir, targetDir, { skipNames: PROJECT_SKIP_NAMES, overwrite });
  }

  /**
   * Ensure root/template/dependencies are usable.
   * Returns internal details that the public ensure()/status() methods trim.
   */
  function ensureInternal() {
    const deps = checkDependencies();
    let initialized = false;
    if (!isDirectory(templateDir)) {
      return {
        ok: false,
        rootDir,
        initialized: false,
        depsOk: deps.depsOk,
        missingDeps: deps.missingDeps,
        error: '模板目录不存在：' + templateDir,
      };
    }
    try {
      if (!pathExists(rootDir)) {
        fs.mkdirSync(rootDir, { recursive: true });
        initialized = true;
        safeLog('created playground directory: ' + rootDir);
      } else if (!isDirectory(rootDir)) {
        return {
          ok: false,
          rootDir,
          initialized: false,
          depsOk: deps.depsOk,
          missingDeps: deps.missingDeps,
          error: 'playground 路径不是目录：' + rootDir,
        };
      }
      const appModulePath = path.join(rootDir, 'src', 'app.module.ts');
      if (!pathExists(appModulePath)) {
        const copied = copyTemplate(templateDir, rootDir, false);
        if (copied.length > 0) {
          initialized = true;
          safeLog('copied playground template (' + String(copied.length) + ' files)');
        }
      }
      const link = ensureModuleLink();
      if (link.created) initialized = true;
      return {
        ok: true,
        rootDir,
        initialized,
        depsOk: deps.depsOk,
        missingDeps: deps.missingDeps,
        moduleLinkOk: link.ok,
        moduleLinkError: link.ok ? null : link.error,
      };
    } catch (error) {
      return {
        ok: false,
        rootDir,
        initialized,
        depsOk: deps.depsOk,
        missingDeps: deps.missingDeps,
        error: '初始化 playground 失败：' + errorMessage(error),
      };
    }
  }

  /** Collect the sandbox TypeScript sources in a stable order. */
  function collectSourceFiles() {
    const sourceDir = path.join(rootDir, 'src');
    if (!isDirectory(sourceDir)) throw new Error('缺少 src 目录');
    const files = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'build') continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(absolute);
          continue;
        }
        if (entry.isFile() && entry.name.endsWith('.ts')) files.push(absolute);
      }
    };
    walk(sourceDir);
    files.sort((left, right) => left.localeCompare(right));
    return files;
  }

  /** Whether Node's CommonJS resolution finds Nest from the playground root. */
  function canResolveFromRoot() {
    try {
      const anchor = createRequire(path.join(rootDir, 'src', '__playground_resolver__.js'));
      anchor.resolve('@nestjs/core');
      return true;
    } catch (_error) {
      return false;
    }
  }
  // #endregion

  // #region logs
  /** Append one (possibly multi-line) string to a run's bounded log buffer. */
  function appendLog(run, message) {
    if (typeof message !== 'string' || message === '') return;
    const lines = message.split(/\r?\n/);
    for (const rawLine of lines) {
      if (rawLine === '') continue;
      const line = clipLogLine(rawLine);
      run.logs.push(line);
      run.logBytes += Buffer.byteLength(line, 'utf8') + 1;
    }
    while (run.logs.length > MAX_LOG_LINES || run.logBytes > MAX_LOG_BYTES) {
      const removed = run.logs.shift();
      if (removed === undefined) break;
      run.logBytes -= Buffer.byteLength(removed, 'utf8') + 1;
    }
    if (run.logBytes < 0) run.logBytes = 0;
  }

  /** Last lines of a run, used as the failure detail. */
  function tailLogs(run, count) {
    const text = run.logs.slice(-count).join('\n');
    if (text.length <= 4000) return text;
    return '…' + text.slice(text.length - 4000);
  }

  /** Remove the active pointer for a terminal run. */
  function clearActive(run) {
    if (activeRunId === run.runId) activeRunId = null;
  }

  /** Move a run to a terminal state without overriding an explicit stop/failure. */
  function finishRun(run, status, error) {
    if (run.status !== 'failed' && run.status !== 'stopped') {
      run.status = status;
      run.error = error === undefined ? null : error;
    }
    if (run.endedAt === null) run.endedAt = Date.now();
    if (run.startTimer !== null) {
      clearTimeout(run.startTimer);
      run.startTimer = null;
    }
    clearActive(run);
  }

  /** Poll-shaped snapshot; callers never receive internal references. */
  function snapshotRun(run) {
    return {
      runId: run.runId,
      status: run.status,
      logs: run.logs.slice(),
      routes: run.routes.map((route) => ({ method: route.method, path: route.path })),
      url: run.url,
      error: run.error,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
    };
  }

  /** Keep the run history bounded. */
  function pruneRuns() {
    if (runs.size <= MAX_RUNS) return;
    for (const [runId, run] of runs) {
      if (runs.size <= MAX_RUNS) break;
      if (runId !== activeRunId && (run.status === 'failed' || run.status === 'stopped')) {
        runs.delete(runId);
      }
    }
  }
  // #endregion

  // #region compilation
  /** Compile every TypeScript file under src/ into build/ and log diagnostics. */
  function compileProject(run) {
    const ts = getTypeScript();
    const appModulePath = path.join(rootDir, 'src', 'app.module.ts');
    if (!pathExists(appModulePath)) {
      appendLog(run, '[compiler] 缺少 src/app.module.ts');
      return { ok: false, error: '缺少 src/app.module.ts' };
    }
    const rootNames = collectSourceFiles();
    if (rootNames.length === 0) {
      appendLog(run, '[compiler] src/ 下没有 .ts 文件');
      return { ok: false, error: 'src/ 下没有 TypeScript 文件' };
    }
    const buildDir = path.join(rootDir, 'build');
    fs.rmSync(buildDir, { recursive: true, force: true });

    /** @type {import('typescript').CompilerOptions} */
    const compilerOptions = {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
      skipLibCheck: true,
      strict: false,
      noEmitOnError: true,
      rootDir,
      outDir: buildDir,
      moduleResolution: ts.ModuleResolutionKind.Node10,
    };
    // A playground outside the plugin tree normally gets a node_modules symlink.
    // If linking was impossible (restricted FS), teach TypeScript to look in the
    // plugin's node_modules directly; NODE_PATH covers runtime resolution.
    if (!canResolveFromRoot()) {
      compilerOptions.baseUrl = rootDir;
      compilerOptions.paths = {
        '*': [path.join(NODE_MODULES_DIR, '*'), path.join(rootDir, 'node_modules', '*')],
      };
    }
    // The playground does not ship @types/node, but real Nest scaffolds use
    // Node globals in src/main.ts (process.env.PORT). Inject a minimal ambient
    // declaration through typeRoots; it stays out of the user's project files.
    const playgroundTypes = path.join(HOST_ROOT, 'playground-types', '@types');
    if (isDirectory(playgroundTypes)) compilerOptions.typeRoots = [playgroundTypes];

    const program = ts.createProgram({ rootNames, options: compilerOptions });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    for (const diagnostic of diagnostics) appendLog(run, formatDiagnostic(ts, diagnostic, rootDir));
    const errors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    if (errors.length > 0) {
      appendLog(run, '[compiler] TypeScript 编译失败：' + String(errors.length) + ' 个错误');
      return { ok: false, error: 'TypeScript 编译失败' };
    }

    const emitResult = program.emit();
    for (const diagnostic of emitResult.diagnostics) {
      appendLog(run, formatDiagnostic(ts, diagnostic, rootDir));
    }
    const emitErrors = emitResult.diagnostics.filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (emitResult.emitSkipped || emitErrors.length > 0) {
      appendLog(run, '[compiler] TypeScript 输出失败');
      return { ok: false, error: 'TypeScript 编译失败' };
    }
    const compiledAppModule = path.join(buildDir, 'src', 'app.module.js');
    if (!pathExists(compiledAppModule)) {
      appendLog(run, '[compiler] 编译产物缺失：build/src/app.module.js');
      return { ok: false, error: '编译产物缺失：build/src/app.module.js' };
    }
    // The plugin itself is an ES module package, so without a local package.json
    // Node would treat the emitted CommonJS files as ESM. Mark the internal build
    // directory explicitly as CommonJS so edits to the root package.json can never
    // break the booted application.
    fs.writeFileSync(path.join(buildDir, 'package.json'), '{\n  "type": "commonjs"\n}\n', 'utf8');
    return { ok: true };
  }
  // #endregion

  // #region child process
  /** Clean environment for the application child process. */
  function buildChildEnv() {
    const env = {};
    const passthrough = [
      'PATH',
      'HOME',
      'TMPDIR',
      'TMP',
      'TEMP',
      'LANG',
      'LC_ALL',
      'SHELL',
      'USER',
      'LOGNAME',
      'TZ',
      'SYSTEMROOT',
      'SystemRoot',
      'COMSPEC',
      'PATHEXT',
      'WINDIR',
      'ELECTRON_RUN_AS_NODE',
    ];
    for (const key of passthrough) {
      const value = process.env[key];
      if (typeof value === 'string' && value !== '') env[key] = value;
    }
    if (env.HOME === undefined) env.HOME = os.homedir();
    if (env.TMPDIR === undefined) env.TMPDIR = os.tmpdir();
    const nodePathEntries = [path.join(rootDir, 'node_modules'), NODE_MODULES_DIR];
    if (typeof process.env.NODE_PATH === 'string' && process.env.NODE_PATH !== '') {
      nodePathEntries.push(process.env.NODE_PATH);
    }
    env.NODE_PATH = Array.from(new Set(nodePathEntries)).join(path.delimiter);
    env.NODE_ENV = 'development';
    /* Real scaffolds listen on process.env.PORT; 0 asks the OS for a free port. */
    env.PORT = '0';
    env.NO_COLOR = '1';
    return env;
  }

  /** Read one stream as lines, prefixing and storing every line. */
  function consumeLines(run, stream, prefix) {
    if (!stream) return null;
    stream.setEncoding('utf8');
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    lines.on('line', (line) => {
      if (prefix === '[stdout] ' && line.startsWith(READY_MARKER)) {
        handleReadyLine(run, line);
        return;
      }
      if (line.trim() === '') return;
      appendLog(run, prefix + line);
    });
    lines.on('error', () => {
      /* stream errors are followed by the child close event */
    });
    return lines;
  }

  /** Parse the runner's READY marker and mark the run as running. */
  function handleReadyLine(run, line) {
    if (run.status !== 'starting') return;
    let payload = null;
    try {
      payload = JSON.parse(line.slice(READY_MARKER.length));
    } catch (_error) {
      payload = null;
    }
    if (payload === null || typeof payload.url !== 'string' || payload.url === '') {
      appendLog(run, '[stderr] 无法解析启动信息（##NEST_READY##）');
      finishRun(run, 'failed', '无法解析应用启动信息');
      const child = run.child;
      if (child) void killChild(child, KILL_GRACE_MS);
      return;
    }
    const routes = [];
    if (Array.isArray(payload.routes)) {
      for (const route of payload.routes) {
        if (route && typeof route.method === 'string' && typeof route.path === 'string') {
          routes.push({ method: route.method.toUpperCase(), path: route.path });
        }
      }
    }
    if (run.startTimer !== null) {
      clearTimeout(run.startTimer);
      run.startTimer = null;
    }
    run.ready = true;
    run.status = 'running';
    run.url = payload.url;
    run.routes = routes;
    run.error = null;
    run.endedAt = null;
    appendLog(run, '[runtime] Nest 应用已启动：' + payload.url);
    if (routes.length > 0) {
      appendLog(
        run,
        '[runtime] 已注册路由：' +
          routes
            .slice(0, 20)
            .map((route) => route.method + ' ' + route.path)
            .join(', '),
      );
    }
    safeLog('playground run ' + run.runId + ' ready at ' + payload.url);
  }

  /** React to the child process closing. */
  function handleChildClose(run, code, signal) {
    if (run.startTimer !== null) {
      clearTimeout(run.startTimer);
      run.startTimer = null;
    }
    run.child = null;
    run.endedAt = Date.now();
    if (run.status === 'failed' || run.status === 'stopped') {
      /* already settled by an explicit stop, a timeout or an earlier error */
    } else if (run.stopRequested) {
      run.status = 'stopped';
      run.error = null;
      appendLog(run, '[runtime] 应用已停止');
    } else if (!run.ready) {
      const tail = tailLogs(run, 12);
      run.status = 'failed';
      run.error = tail === '' ? '应用在就绪前退出（退出码 ' + String(code) + '）' : tail;
      appendLog(
        run,
        '[stderr] 应用在就绪前退出（退出码 ' +
          String(code === null ? 'null' : code) +
          (signal ? '，信号 ' + String(signal) : '') +
          '）',
      );
    } else {
      run.status = 'stopped';
      appendLog(
        run,
        '[runtime] 应用进程已退出（退出码 ' +
          String(code === null ? 'null' : code) +
          (signal ? '，信号 ' + String(signal) : '') +
          '）',
      );
    }
    clearActive(run);
  }

  /** SIGTERM, wait, then SIGKILL; resolves once the child is gone or the grace elapsed. */
  function killChild(child, graceMs) {
    return new Promise((resolve) => {
      if (!child) {
        resolve();
        return;
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      let finished = false;
      let forceTimer = null;
      let safetyTimer = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (forceTimer !== null) clearTimeout(forceTimer);
        if (safetyTimer !== null) clearTimeout(safetyTimer);
        child.removeListener('close', finish);
        resolve();
      };
      child.once('close', finish);
      forceTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          try {
            child.kill('SIGKILL');
          } catch (_error) {
            /* the process may already be gone */
          }
        }
        const settleTimer = setTimeout(finish, 500);
        if (typeof settleTimer.unref === 'function') settleTimer.unref();
      }, graceMs);
      if (typeof forceTimer.unref === 'function') forceTimer.unref();
      try {
        child.kill('SIGTERM');
      } catch (_error) {
        finish();
        return;
      }
      safetyTimer = setTimeout(finish, graceMs + 1500);
      if (typeof safetyTimer.unref === 'function') safetyTimer.unref();
    });
  }

  /** Spawn `<rootDir>/runner.cjs` and wire its streams into the run. */
  function spawnRunner(run) {
    run.status = 'starting';
    appendLog(run, '[runtime] 正在启动 Nest 应用（node ' + nodePath + '）');

    let child;
    try {
      child = spawnChild();
    } catch (error) {
      appendLog(run, '[stderr] 无法启动 Node 进程：' + errorMessage(error));
      finishRun(run, 'failed', '无法启动 Node 进程：' + errorMessage(error));
      return;
    }
    run.child = child;
    run.startTimer = setTimeout(() => {
      if (run.ready || run.status !== 'starting') return;
      run.startTimer = null;
      appendLog(run, '[stderr] 启动超时（30s）');
      finishRun(run, 'failed', '启动超时（30s）');
      run.stopRequested = true;
      if (run.child) void killChild(run.child, KILL_GRACE_MS);
    }, START_TIMEOUT_MS);
    if (typeof run.startTimer.unref === 'function') run.startTimer.unref();

    run.stdoutInterface = consumeLines(run, child.stdout, '[stdout] ');
    run.stderrInterface = consumeLines(run, child.stderr, '[stderr] ');

    child.once('error', (error) => {
      appendLog(run, '[stderr] 子进程错误：' + errorMessage(error));
      if (run.status === 'starting') {
        finishRun(run, 'failed', '无法启动 Node 进程：' + errorMessage(error));
      }
    });
    child.once('close', (code, signal) => {
      try {
        if (run.stdoutInterface) run.stdoutInterface.close();
        if (run.stderrInterface) run.stderrInterface.close();
      } catch (_error) {
        /* ignore */
      }
      run.stdoutInterface = null;
      run.stderrInterface = null;
      handleChildClose(run, code, signal);
    });
    safeLog('playground run ' + run.runId + ' spawned pid ' + String(child.pid === undefined ? '?' : child.pid));
  }

  /** The actual `child_process.spawn` call, isolated so failures are catchable. */
  function spawnChild() {
    return spawn(nodePath, ['runner.cjs'], {
      cwd: rootDir,
      env: buildChildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  }
  // #endregion

  // #region run lifecycle
  /** Advance a run from compiling to starting. */
  async function runJob(run) {
    try {
      if (run.cancelled || disposed) {
        finishRun(run, 'stopped');
        return;
      }
      run.status = 'compiling';
      // Rewrite the bootstrap on every start so a stale runner can never be used.
      fs.writeFileSync(path.join(rootDir, 'runner.cjs'), RUNNER_SOURCE, 'utf8');
      appendLog(run, '[runtime] 正在编译 TypeScript 文件…');
      const compileStartedAt = Date.now();
      const compiled = compileProject(run);
      if (run.cancelled || disposed) {
        finishRun(run, 'stopped');
        return;
      }
      if (!compiled.ok) {
        finishRun(run, 'failed', compiled.error);
        return;
      }
      appendLog(run, '[runtime] 编译完成（' + String(Date.now() - compileStartedAt) + ' ms）');
      spawnRunner(run);
    } catch (error) {
      appendLog(run, '[stderr] ' + errorMessage(error));
      finishRun(run, 'failed', '启动失败：' + errorMessage(error));
    }
  }

  /** Resolve a run id argument (or the active run) to a run object. */
  function findRun(runId) {
    if (typeof runId === 'string' && runId !== '') return runs.get(runId) || null;
    return null;
  }
  // #endregion

  // #region public API
  return {
    /** Ensure the playground directory, template and dependency resolution. */
    async ensure() {
      if (disposed) {
        return {
          ok: false,
          rootDir,
          initialized: false,
          depsOk: false,
          missingDeps: checkDependencies().missingDeps,
          error: '运行时已释放',
        };
      }
      const state = ensureInternal();
      const result = {
        ok: state.ok === true,
        rootDir,
        initialized: state.initialized === true,
        depsOk: state.depsOk === true,
        missingDeps: state.missingDeps,
      };
      if (state.ok !== true) result.error = state.error;
      return result;
    },

    /** Report dependencies and the currently active run, if any. */
    async status() {
      const deps = checkDependencies();
      const active = activeRunId === null ? null : runs.get(activeRunId);
      return {
        rootDir,
        nodePath,
        ready:
          !disposed &&
          deps.depsOk &&
          isDirectory(templateDir) &&
          isExecutableFile(nodePath),
        depsOk: deps.depsOk,
        missingDeps: deps.missingDeps,
        activeRunId: active ? active.runId : null,
        activeStatus: active ? active.status : null,
      };
    },

    /**
     * List editable files: src/** plus the root package.json/tsconfig.json.
     * Directories under src/ are returned too (including empty ones) so the
     * editor can render a real project tree.
     *
     * This method is strictly read-only: it never re-copies the template, so a
     * file the user just deleted can never "come back" simply because the tree
     * was refreshed. Template self-heal happens only in ensure()/start()/reset().
     */
    async listFiles() {
      const files = [];
      const dirs = [];
      const addFile = (absolute, relative) => {
        try {
          const stat = fs.statSync(absolute);
          if (!stat.isFile()) return;
          files.push({ path: toPosix(relative), size: stat.size, mtime: Math.round(stat.mtimeMs) });
        } catch (_error) {
          /* a file racing with deletion is simply omitted */
        }
      };
      // Real Nest scaffolds also contain project-root files (package.json,
      // tsconfig*.json, nest-cli.json, README, dotfiles). Expose them so the
      // editor tree matches the actual project instead of only src/**.
      let rootEntries = [];
      try {
        rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
      } catch (_error) {
        rootEntries = [];
      }
      for (const entry of rootEntries) {
        if (!entry.isFile()) continue;
        if (entry.name === 'runner.cjs' || entry.name.indexOf('.tmp-') >= 0) continue;
        addFile(path.join(rootDir, entry.name), entry.name);
      }
      const sourceDir = path.join(rootDir, 'src');
      if (isDirectory(sourceDir)) {
        dirs.push({ path: 'src' });
        const walk = (directory) => {
          let entries;
          try {
            entries = fs.readdirSync(directory, { withFileTypes: true });
          } catch (_error) {
            return;
          }
          for (const entry of entries) {
            // Manually created node_modules/build directories inside src/ are
            // runtime artifacts and must never flood the editor tree.
            if (entry.name === 'node_modules' || entry.name === 'build') continue;
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) {
              dirs.push({ path: toPosix(path.relative(rootDir, absolute)) });
              walk(absolute);
              continue;
            }
            if (entry.isFile()) addFile(absolute, path.relative(rootDir, absolute));
          }
        };
        walk(sourceDir);
      }
      files.sort((left, right) => left.path.localeCompare(right.path));
      dirs.sort((left, right) => left.path.localeCompare(right.path));
      return { files, dirs };
    },

    /** Read one text file inside the playground. */
    async readFile(relPath) {
      const target = resolveRelativePath(relPath, 'read');
      let stat;
      try {
        stat = fs.statSync(target.absolute);
      } catch (_error) {
        throw new Error('文件不存在：' + target.relative);
      }
      if (!stat.isFile()) throw new Error('不是文件：' + target.relative);
      return { path: target.relative, content: fs.readFileSync(target.absolute, 'utf8') };
    },

    /** Overwrite one text file (max 512 KB) inside the playground. */
    async writeFile(relPath, content) {
      if (typeof content !== 'string') throw new Error('content 必须是字符串');
      const size = Buffer.byteLength(content, 'utf8');
      if (size > MAX_FILE_BYTES) throw new Error('文件超过 512KB 限制');
      const target = resolveRelativePath(relPath, 'write');
      let temporary = null;
      try {
        fs.mkdirSync(path.dirname(target.absolute), { recursive: true });
        temporary = target.absolute + '.tmp-' + String(process.pid) + '-' + String(Date.now());
        fs.writeFileSync(temporary, content, 'utf8');
        fs.renameSync(temporary, target.absolute);
        temporary = null;
      } catch (error) {
        throw new Error('写入文件失败：' + errorMessage(error));
      } finally {
        if (temporary !== null) {
          try {
            fs.rmSync(temporary, { force: true });
          } catch (_error) {
            /* best-effort cleanup of a partial write */
          }
        }
      }
      return { path: target.relative, size };
    },

    /** Create a new file or directory (never overwrites an existing entry). */
    async createEntry(relPath, kind) {
      if (kind !== 'file' && kind !== 'dir') throw new Error('kind 必须是 "file" 或 "dir"');
      const target = resolveRelativePath(relPath, 'create');
      if (kind === 'dir') {
        if (pathExists(target.absolute) && !isDirectory(target.absolute)) {
          throw new Error('已存在同名文件：' + target.relative);
        }
        try {
          fs.mkdirSync(target.absolute, { recursive: true });
        } catch (error) {
          throw new Error('创建目录失败：' + errorMessage(error));
        }
      } else {
        if (pathExists(target.absolute)) throw new Error('已存在同名文件或目录：' + target.relative);
        try {
          fs.mkdirSync(path.dirname(target.absolute), { recursive: true });
          fs.writeFileSync(target.absolute, '', { encoding: 'utf8', flag: 'wx' });
        } catch (error) {
          throw new Error('创建文件失败：' + errorMessage(error));
        }
      }
      return { path: target.relative };
    },

    /** Delete one file or directory (protected runtime paths are refused). */
    async deleteEntry(relPath) {
      const target = resolveRelativePath(relPath, 'delete');
      try {
        if (!pathExists(target.absolute)) return { path: target.relative };
        fs.rmSync(target.absolute, { recursive: true, force: false });
      } catch (error) {
        throw new Error('删除失败：' + errorMessage(error));
      }
      return { path: target.relative };
    },

    /**
     * Replace the entire workspace with the project found in `sourceDir`.
     *
     * The caller is responsible for stopping a running application first (the
     * project store does this before every module/version switch). Dependency
     * links (`<rootDir>/node_modules`) are preserved, and runtime artifacts
     * (`build/`, `runner.cjs`) are always removed.
     *
     * @param {string} sourceDir absolute directory with package.json/tsconfig.json/src
     * @returns {Promise<{ok: true, files: string[]}>}
     */
    async replaceFrom(sourceDir) {
      if (disposed) throw new Error('运行时已释放');
      if (typeof sourceDir !== 'string' || sourceDir.trim() === '') throw new Error('模板目录不存在：' + String(sourceDir));
      const resolvedSource = path.resolve(sourceDir.trim());
      if (!isDirectory(resolvedSource)) throw new Error('模板目录不存在：' + resolvedSource);
      try {
        fs.mkdirSync(rootDir, { recursive: true });
        fs.rmSync(path.join(rootDir, 'src'), { recursive: true, force: true });
        fs.rmSync(path.join(rootDir, 'build'), { recursive: true, force: true });
        fs.rmSync(path.join(rootDir, 'runner.cjs'), { recursive: true, force: true });
        const files = copyProjectTree(resolvedSource, rootDir, {
          skipNames: PROJECT_SKIP_NAMES,
          overwrite: true,
        });
        ensureModuleLink();
        safeLog('replaced playground from ' + resolvedSource + ' (' + String(files.length) + ' files)');
        return { ok: true, files };
      } catch (error) {
        throw new Error('替换工作区失败：' + errorMessage(error));
      }
    },

    /**
     * Copy the current workspace project into `targetDir` (snapshot capture).
     *
     * `targetDir` is replaced: it is created when missing and cleared when it
     * already exists. Runtime artifacts and half-written temporary files are
     * never captured.
     *
     * @param {string} targetDir absolute destination directory
     * @returns {Promise<{ok: true, files: string[]}>}
     */
    async captureTo(targetDir) {
      if (disposed) throw new Error('运行时已释放');
      if (typeof targetDir !== 'string' || targetDir.trim() === '') throw new Error('目标目录不能为空');
      const resolvedTarget = path.resolve(targetDir.trim());
      if (!path.isAbsolute(targetDir.trim())) throw new Error('目标目录必须是绝对路径：' + targetDir);
      // Clearing an overlapping directory would delete the workspace or the
      // plugin root itself, so overlapping targets are refused outright.
      if (isInside(resolvedTarget, rootDir) || isInside(rootDir, resolvedTarget)) {
        throw new Error('目标目录不能与工作区重叠：' + resolvedTarget);
      }
      try {
        fs.rmSync(resolvedTarget, { recursive: true, force: true });
        fs.mkdirSync(resolvedTarget, { recursive: true });
        const files = isDirectory(rootDir)
          ? copyProjectTree(rootDir, resolvedTarget, {
              skipNames: PROJECT_SKIP_NAMES,
              skipTmp: true,
              overwrite: true,
            })
          : [];
        return { ok: true, files };
      } catch (error) {
        throw new Error('复制工作区失败：' + errorMessage(error));
      }
    },

    /** Stop any active run and restore the original template (sandbox reset). */
    async reset() {
      if (disposed) return { ok: false, error: '运行时已释放', files: [] };
      if (!isDirectory(templateDir)) {
        return { ok: false, error: '模板目录不存在：' + templateDir, files: [] };
      }
      try {
        if (activeRunId !== null) {
          const active = runs.get(activeRunId);
          if (active && (active.status === 'compiling' || active.status === 'starting' || active.status === 'running')) {
            await this.stop(active.runId);
          }
        }
        const replaced = await this.replaceFrom(templateDir);
        safeLog('reset playground (' + String(replaced.files.length) + ' template files)');
        return { ok: true, files: replaced.files };
      } catch (error) {
        return { ok: false, error: '重置 playground 失败：' + errorMessage(error), files: [] };
      }
    },

    /**
     * Start a compile+boot run. Returns immediately with a runId; the compile,
     * spawn and readiness handling continue in the background.
     */
    async start() {
      if (disposed) throw new Error('运行时已释放，无法启动');
      const state = ensureInternal();
      if (!state.ok) throw new Error(state.error === undefined ? '初始化 playground 失败' : state.error);
      if (!state.depsOk) throw new Error('缺少运行依赖：' + state.missingDeps.join(', '));
      if (!isExecutableFile(nodePath)) throw new Error('Node 可执行文件不存在或不可执行：' + nodePath);
      if (!isDirectory(templateDir)) throw new Error('模板目录不存在：' + templateDir);

      let stopGuard = 0;
      while (stopGuard < 5) {
        const active = activeRunId === null ? null : runs.get(activeRunId);
        const live =
          active !== null &&
          active !== undefined &&
          (active.status === 'compiling' || active.status === 'starting' || active.status === 'running');
        if (!live) break;
        stopGuard += 1;
        await this.stop(active.runId);
      }
      const remainingActive = activeRunId === null ? null : runs.get(activeRunId);
      if (
        remainingActive &&
        (remainingActive.status === 'compiling' ||
          remainingActive.status === 'starting' ||
          remainingActive.status === 'running')
      ) {
        throw new Error('无法停止上一个运行实例，请稍后重试');
      }
      // Drop a stale pointer left by a terminal run.
      activeRunId = null;

      runCounter += 1;
      const runId = 'run-' + Date.now().toString(36) + '-' + runCounter.toString(36);
      const run = {
        runId,
        status: 'compiling',
        logs: [],
        logBytes: 0,
        routes: [],
        url: null,
        error: null,
        startedAt: Date.now(),
        endedAt: null,
        ready: false,
        cancelled: false,
        stopRequested: false,
        child: null,
        startTimer: null,
        stdoutInterface: null,
        stderrInterface: null,
      };
      runs.set(runId, run);
      activeRunId = runId;
      pruneRuns();
      safeLog('playground run ' + runId + ' requested');
      setImmediate(() => {
        void runJob(run);
      });
      return { runId };
    },

    /** Return a snapshot of one run. */
    async poll(runId) {
      if (typeof runId !== 'string' || runId === '') throw new Error('缺少 runId 参数');
      const run = findRun(runId);
      if (run === null) throw new Error('运行实例不存在或已过期：' + runId);
      return snapshotRun(run);
    },

    /** Proxy one HTTP request into the running Nest application. */
    async request(runId, requestOptions) {
      const startedAt = Date.now();
      const run = typeof runId === 'string' && runId !== '' ? runs.get(runId) : null;
      if (run) {
        if (run.status !== 'running' || typeof run.url !== 'string' || run.url === '') {
          return {
            status: 0,
            statusText: '',
            headers: {},
            body: '',
            error: '应用尚未运行',
            timeMs: Date.now() - startedAt,
          };
        }
        const request = requestOptions !== null && typeof requestOptions === 'object' ? requestOptions : {};
        const method = String(request.method === undefined || request.method === null ? 'GET' : request.method)
          .toUpperCase()
          .trim();
        if (!/^[A-Z]+$/.test(method)) {
          return {
            status: 0,
            statusText: '',
            headers: {},
            body: '',
            error: '非法的 HTTP 方法：' + method,
            timeMs: Date.now() - startedAt,
          };
        }
        const requestPath = typeof request.path === 'string' && request.path !== '' ? request.path : '/';
        if (!requestPath.startsWith('/') || /[\r\n\0]/.test(requestPath)) {
          return {
            status: 0,
            statusText: '',
            headers: {},
            body: '',
            error: '非法的请求路径：' + requestPath,
            timeMs: Date.now() - startedAt,
          };
        }
        let base;
        let target;
        try {
          base = new URL(run.url);
          target = new URL(requestPath, base);
        } catch (_error) {
          return {
            status: 0,
            statusText: '',
            headers: {},
            body: '',
            error: '无法解析请求地址：' + requestPath,
            timeMs: Date.now() - startedAt,
          };
        }
        if (target.origin !== base.origin) {
          return {
            status: 0,
            statusText: '',
            headers: {},
            body: '',
            error: '请求路径不允许指向其他主机：' + requestPath,
            timeMs: Date.now() - startedAt,
          };
        }

        const headers = {};
        if (request.headers !== null && typeof request.headers === 'object') {
          for (const [key, value] of Object.entries(request.headers)) {
            if (typeof value === 'string' || typeof value === 'number') headers[key] = String(value);
          }
        }
        let body;
        if (typeof request.body === 'string') body = request.body;
        else if (request.body !== undefined && request.body !== null) body = JSON.stringify(request.body);
        if (body !== undefined && body !== '' && method !== 'GET' && method !== 'HEAD') {
          const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
          if (!hasContentType) headers['content-type'] = 'application/json';
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const init = { method, headers, signal: controller.signal };
          if (body !== undefined && body !== '' && method !== 'GET' && method !== 'HEAD') init.body = body;
          const response = await fetch(target.href, init);
          const text = await readLimitedBody(response, MAX_RESPONSE_BYTES);
          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            body: text,
            timeMs: Date.now() - startedAt,
          };
        } catch (error) {
          return {
            status: 0,
            statusText: '',
            headers: {},
            body: '',
            error: controller.signal.aborted ? '请求超时（10s）' : errorMessage(error),
            timeMs: Date.now() - startedAt,
          };
        } finally {
          clearTimeout(timer);
        }
      }
      return {
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        error: '运行实例不存在或已过期：' + String(runId),
        timeMs: Date.now() - startedAt,
      };
    },

    /** Stop the active run (or one specific run). Idempotent. */
    async stop(runId) {
      let run = null;
      if (runId === undefined || runId === null || runId === '') {
        if (activeRunId === null) return { ok: true };
        run = runs.get(activeRunId) || null;
        if (run === null) {
          activeRunId = null;
          return { ok: true };
        }
      } else {
        run = findRun(runId);
        if (run === null) return { ok: false, error: '运行实例不存在或已过期：' + String(runId) };
      }
      clearActive(run);
      run.cancelled = true;
      run.stopRequested = true;
      if (run.startTimer !== null) {
        clearTimeout(run.startTimer);
        run.startTimer = null;
      }
      const wasLive = run.status === 'compiling' || run.status === 'starting' || run.status === 'running';
      const child = run.child;
      run.status = 'stopped';
      run.error = null;
      run.endedAt = Date.now();
      if (child) await killChild(child, KILL_GRACE_MS);
      if (wasLive) safeLog('playground run ' + run.runId + ' stopped');
      return { ok: true };
    },

    /** Stop every child process and drop run state (plugin unload). Idempotent. */
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const run of runs.values()) {
        run.cancelled = true;
        run.stopRequested = true;
        if (run.startTimer !== null) {
          clearTimeout(run.startTimer);
          run.startTimer = null;
        }
        if (run.status === 'compiling' || run.status === 'starting' || run.status === 'running') {
          run.status = 'stopped';
          run.endedAt = Date.now();
        }
        const child = run.child;
        if (child !== null && child.exitCode === null && child.signalCode === null) {
          try {
            child.kill('SIGTERM');
          } catch (_error) {
            /* already gone */
          }
          const timer = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) {
              try {
                child.kill('SIGKILL');
              } catch (_error) {
                /* already gone */
              }
            }
          }, KILL_GRACE_MS);
          if (typeof timer.unref === 'function') timer.unref();
        }
        run.child = null;
      }
      activeRunId = null;
      runs.clear();
      safeLog('playground runtime disposed');
    },
  };
  // #endregion
}

// #region request body helper
/** Read at most `maxBytes` from a fetch Response without buffering more than needed. */
async function readLimitedBody(response, maxBytes) {
  if (!response || response.body === null || response.body === undefined) {
    const text = await response.text();
    return Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;
      const remaining = maxBytes - total;
      const chunk = Buffer.from(value);
      if (chunk.length > remaining) {
        chunks.push(chunk.subarray(0, remaining));
        total += remaining;
        try {
          await reader.cancel();
        } catch (_error) {
          /* cancellation is best-effort */
        }
        break;
      }
      chunks.push(chunk);
      total += chunk.length;
    }
  } finally {
    if (total >= maxBytes) {
      try {
        await reader.cancel();
      } catch (_error) {
        /* ignore */
      }
    }
  }
  return Buffer.concat(chunks, total).toString('utf8');
}
// #endregion
