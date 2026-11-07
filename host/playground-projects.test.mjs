/**
 * Standalone verification for the playground project store (host/playground-projects.js).
 *
 * Run with: node host/playground-projects.test.mjs
 *
 * Everything happens inside a throw-away os.tmpdir() directory: two practice
 * modules (sandbox + s1-1), a synthetic workspace, snapshot collection and
 * state file. The script also covers the SPEC §11 runtime fixes (listFiles is
 * read-only, deleteEntry guard list, src/node_modules + src/build walk skip)
 * and the new runtime replaceFrom/captureTo primitives.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlaygroundRuntime } from './playground-runtime.js';
import { createProjectStore } from './playground-projects.js';

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(HOST_DIR, 'playground-template');
const PLUGIN_NODE_MODULES = path.resolve(HOST_DIR, '..', 'node_modules');
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-assistant-projects-test-'));

const ROOT_DIR = path.join(TMP_ROOT, 'playground');
const MODULES_DIR = path.join(TMP_ROOT, 'playground-modules');
const SAVES_DIR = path.join(TMP_ROOT, 'playground-saves');
const STATE_FILE = path.join(TMP_ROOT, 'playground-state.json');
const RUNTIME_ROOT = path.join(TMP_ROOT, 'runtime-root');
const CAPTURE_DIR = path.join(TMP_ROOT, 'capture');
const REPLACEMENT_DIR = path.join(TMP_ROOT, 'replacement');

let passed = false;
let cleanupFailed = false;
const logs = [];

/** Print one progress checkpoint. */
function step(message) {
  console.log('[test] ' + message);
}

/** Write a relative file under a project directory. */
function writeProjectFile(baseDir, relPath, content) {
  const absolute = path.join(baseDir, relPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
}

/** Read a relative file under a project directory. */
function readProjectFile(baseDir, relPath) {
  return fs.readFileSync(path.join(baseDir, relPath), 'utf8');
}

/** Whether a relative file exists under a project directory. */
function projectFileExists(baseDir, relPath) {
  return fs.existsSync(path.join(baseDir, relPath));
}

/** Write one module.json + default project. */
function makeModule(moduleId, meta, files) {
  const moduleRoot = path.join(MODULES_DIR, moduleId);
  fs.mkdirSync(moduleRoot, { recursive: true });
  fs.writeFileSync(
    path.join(moduleRoot, 'module.json'),
    JSON.stringify(Object.assign({ id: moduleId }, meta), null, 2) + '\n',
    'utf8',
  );
  const defaultDir = path.join(moduleRoot, 'default');
  fs.mkdirSync(defaultDir, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) writeProjectFile(defaultDir, relPath, content);
}

/** Read the state file as JSON. */
function readStateFile() {
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

/** List the directories directly under one directory (empty when missing). */
function listDirectories(directory) {
  try {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (_error) {
    return [];
  }
}

/** Remove a temp playground without ever following its node_modules symlink. */
function cleanRoot(directory) {
  try {
    const link = path.join(directory, 'node_modules');
    if (fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
  } catch (_error) {
    /* no link */
  }
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch (_error) {
    /* cleanup is best-effort, verified separately */
  }
}

// #region fixtures
step('node ' + process.version + ' (' + process.execPath + ')');
step('temp root ' + TMP_ROOT);

makeModule(
  'sandbox',
  {
    itemId: null,
    stageId: 'sandbox',
    stageIndex: 0,
    itemIndex: 0,
    stageTitleZh: '自由沙盒',
    titleZh: '自由沙盒（原始示例）',
    title: 'Free sandbox',
    level: 'L1',
    summary: '沙盒默认代码',
    defaultFile: 'src/app.module.ts',
  },
  {
    'package.json': '{"name":"nest-playground","private":true,"type":"commonjs"}\n',
    'tsconfig.json': '{"compilerOptions":{}}\n',
    'src/app.module.ts': "export const MARKER = 'SANDBOX';\nexport class AppModule {}\n",
    'src/cats/cats.service.ts': "export const CATS = 'sandbox cats';\n",
  },
);

makeModule(
  's1-1',
  {
    itemId: 's1-1',
    stageId: 's1',
    stageIndex: 1,
    itemIndex: 1,
    stageTitleZh: '心智模型与最小可运行',
    titleZh: '搭起可运行项目与启动链路',
    title: '搭起可运行项目与启动链路',
    level: 'L1',
    summary: '最小可运行骨架',
    defaultFile: 'src/app.module.ts',
  },
  {
    'package.json': '{"name":"nest-playground","private":true,"type":"commonjs"}\n',
    'tsconfig.json': '{"compilerOptions":{}}\n',
    'src/app.module.ts': "export const MARKER = 'S1-1';\nexport class AppModule {}\n",
    'src/extra.ts': "export const EXTRA = 's1-1 only';\n",
  },
);

const runtime = createPlaygroundRuntime({
  rootDir: ROOT_DIR,
  templateDir: TEMPLATE_DIR,
  nodePath: process.execPath,
  log(line) {
    logs.push(line);
  },
});

const store = createProjectStore({
  pluginRoot: TMP_ROOT,
  rootDir: ROOT_DIR,
  templateDir: TEMPLATE_DIR,
  modulesDir: MODULES_DIR,
  savesDir: SAVES_DIR,
  stateFile: STATE_FILE,
  runtime,
  log(line) {
    logs.push(line);
  },
});
// #endregion

try {
  // #region default state + ensure
  const initialStatus = await store.status();
  assert.ok(initialStatus.active !== null, 'status must expose the active module');
  assert.equal(initialStatus.active.moduleId, 'sandbox');
  assert.deepEqual(initialStatus.active.version, { kind: 'default' });
  assert.equal(initialStatus.active.dirty, false);
  step('status before ensure -> sandbox/default');

  const ensured = await store.ensure();
  assert.equal(ensured.ok, true);
  assert.equal(ensured.active.moduleId, 'sandbox');
  assert.deepEqual(ensured.active.version, { kind: 'default' });
  assert.equal(ensured.active.dirty, false);
  assert.ok(projectFileExists(ROOT_DIR, 'src/app.module.ts'), 'ensure must seed the workspace');
  assert.ok(readProjectFile(ROOT_DIR, 'src/app.module.ts').includes('SANDBOX'));
  assert.ok(fs.existsSync(SAVES_DIR), 'ensure must create the snapshot collection directory');
  assert.ok(fs.existsSync(MODULES_DIR));
  const stateAfterEnsure = readStateFile();
  assert.equal(stateAfterEnsure.version, 1);
  assert.equal(stateAfterEnsure.activeModuleId, 'sandbox');
  assert.equal(stateAfterEnsure.dirty, false);
  assert.deepEqual(stateAfterEnsure.versions.sandbox, { kind: 'default' });
  step('ensure seeded sandbox/default and wrote playground-state.json');

  // ensure() must never overwrite an existing workspace.
  writeProjectFile(ROOT_DIR, 'src/keep-me.ts', '// keep this file\n');
  await store.ensure();
  assert.ok(projectFileExists(ROOT_DIR, 'src/keep-me.ts'), 'ensure must not overwrite workspace files');
  await runtime.deleteEntry('src/keep-me.ts');
  step('ensure is idempotent and preserves existing workspace files');
  // #endregion

  // #region module listing + switching
  const listing = await store.listModules();
  assert.equal(listing.modules.length, 2);
  assert.deepEqual(
    listing.modules.map((module) => module.id),
    ['sandbox', 's1-1'],
    'modules must be sorted by stageIndex/itemIndex (sandbox first)',
  );
  assert.equal(listing.active.moduleId, 'sandbox');
  const sandboxSummary = listing.modules[0];
  assert.equal(sandboxSummary.titleZh, '自由沙盒（原始示例）');
  assert.equal(sandboxSummary.stageId, 'sandbox');
  assert.equal(sandboxSummary.defaultFile, 'src/app.module.ts');
  assert.ok(Array.isArray(sandboxSummary.snapshots) && sandboxSummary.snapshots.length === 0);
  const s11Summary = listing.modules[1];
  assert.equal(s11Summary.stageIndex, 1);
  assert.equal(s11Summary.itemIndex, 1);
  assert.ok(s11Summary.summary.includes('最小可运行'));
  step('listModules returned 2 sorted summaries with empty snapshots');

  await assert.rejects(() => store.switchModule('does-not-exist'), /未知模块/);
  await assert.rejects(() => store.switchModule('../escape'), /未知模块/);
  await assert.rejects(() => store.switchModule('S1-1'), /未知模块/);
  step('switchModule rejects unknown / invalid module ids');

  const switched = await store.switchModule('s1-1');
  assert.equal(switched.active.moduleId, 's1-1');
  assert.deepEqual(switched.active.version, { kind: 'default' });
  assert.equal(switched.active.dirty, false);
  assert.ok(readProjectFile(ROOT_DIR, 'src/app.module.ts').includes('S1-1'));
  assert.ok(!projectFileExists(ROOT_DIR, 'src/cats/cats.service.ts'), 'old module files must be removed');
  assert.equal(readStateFile().activeModuleId, 's1-1');
  step('switchModule replaced the workspace with s1-1/default');
  // #endregion

  // #region dirty flag
  store.markDirty();
  assert.equal((await store.status()).active.dirty, true);
  assert.equal((await store.listModules()).active.dirty, true);
  assert.equal(readStateFile().dirty, true);
  step('markDirty() persisted dirty=true');
  // #endregion

  // #region saveSnapshot
  // Runtime artifacts / temp files placed next to the sources must never be captured.
  fs.mkdirSync(path.join(ROOT_DIR, 'build'), { recursive: true });
  fs.writeFileSync(path.join(ROOT_DIR, 'build', 'stale.js'), '// build artifact\n', 'utf8');
  fs.writeFileSync(path.join(ROOT_DIR, 'runner.cjs'), '// runner artifact\n', 'utf8');
  fs.mkdirSync(path.join(ROOT_DIR, '.git'), { recursive: true });
  fs.writeFileSync(path.join(ROOT_DIR, '.git', 'config'), '[core]\n', 'utf8');
  fs.writeFileSync(path.join(ROOT_DIR, '.DS_Store'), 'junk', 'utf8');
  fs.writeFileSync(path.join(ROOT_DIR, 'src', 'half.ts.tmp-1-2'), '// partial write\n', 'utf8');

  const saved = await store.saveSnapshot('  我的实现  ');
  assert.match(saved.snapshot.id, /^s-[0-9a-z]+-[a-z0-9]{3}$/, 'snapshot id is server generated');
  assert.equal(saved.snapshot.name, '我的实现', 'snapshot name must be trimmed');
  assert.equal(saved.snapshot.fileCount > 0, true);
  assert.equal(typeof saved.snapshot.createdAt, 'number');
  assert.equal(typeof saved.snapshot.updatedAt, 'number');
  assert.equal(saved.active.version.kind, 'snapshot');
  assert.equal(saved.active.version.snapshotId, saved.snapshot.id);
  assert.equal(saved.active.version.name, '我的实现');
  assert.equal(saved.active.dirty, false);
  const snapshotRoot = path.join(SAVES_DIR, 's1-1', saved.snapshot.id);
  const snapshotFiles = path.join(snapshotRoot, 'files');
  const snapshotMeta = JSON.parse(fs.readFileSync(path.join(snapshotRoot, 'meta.json'), 'utf8'));
  assert.deepEqual(snapshotMeta, saved.snapshot);
  assert.ok(projectFileExists(snapshotFiles, 'src/app.module.ts'));
  assert.ok(projectFileExists(snapshotFiles, 'package.json'));
  assert.ok(!projectFileExists(snapshotFiles, 'build'), 'build/ must not be captured');
  assert.ok(!projectFileExists(snapshotFiles, 'runner.cjs'), 'runner.cjs must not be captured');
  assert.ok(!projectFileExists(snapshotFiles, '.git'), '.git must not be captured');
  assert.ok(!projectFileExists(snapshotFiles, '.DS_Store'), '.DS_Store must not be captured');
  assert.ok(
    !projectFileExists(snapshotFiles, 'src/half.ts.tmp-1-2'),
    '*.tmp-* files must not be captured',
  );
  assert.ok(!projectFileExists(snapshotFiles, 'node_modules'), 'node_modules must not be captured');
  const afterSave = await store.listModules();
  assert.equal(afterSave.active.version.kind, 'snapshot');
  assert.equal(afterSave.modules[1].snapshots.length, 1);
  assert.equal(afterSave.modules[1].snapshots[0].name, '我的实现');
  step('saveSnapshot captured ' + String(saved.snapshot.fileCount) + ' files (no runtime artifacts)');
  // #endregion

  // #region snapshot name validation
  const dirsBeforeBadSaves = listDirectories(path.join(SAVES_DIR, 's1-1'));
  await assert.rejects(() => store.saveSnapshot('我的实现'), /同名/);
  for (const badName of ['', '   ', 'a'.repeat(61), 'a/b', 'a\\b', 'x\u0000y', 42]) {
    await assert.rejects(() => store.saveSnapshot(badName), /版本名称/);
  }
  assert.deepEqual(
    listDirectories(path.join(SAVES_DIR, 's1-1')),
    dirsBeforeBadSaves,
    'rejected snapshot names must not leave directories behind',
  );
  step('saveSnapshot rejects duplicate and invalid names without side effects');
  // #endregion

  // #region loadVersion
  await runtime.writeFile('src/app.module.ts', "export const MARKER = 'MUTATED';\n");
  store.markDirty();
  const loadedSnapshot = await store.loadVersion('snapshot', saved.snapshot.id);
  assert.equal(loadedSnapshot.active.version.kind, 'snapshot');
  assert.equal(loadedSnapshot.active.version.snapshotId, saved.snapshot.id);
  assert.equal(loadedSnapshot.active.dirty, false);
  assert.ok(readProjectFile(ROOT_DIR, 'src/app.module.ts').includes('S1-1'));
  assert.ok(!readProjectFile(ROOT_DIR, 'src/app.module.ts').includes('MUTATED'));
  assert.equal(readStateFile().versions['s1-1'].snapshotId, saved.snapshot.id);
  step('loadVersion(snapshot) restored the saved files');

  await assert.rejects(() => store.loadVersion('snapshot', 's-notthere-000'), /代码版本不存在/);
  await assert.rejects(() => store.loadVersion('snapshot', '../etc'), /代码版本不存在/);
  await assert.rejects(() => store.loadVersion('bogus'), /未知的版本类型/);
  step('loadVersion rejects missing snapshots and unknown kinds');

  // Switching away and back brings the module's last used version.
  await store.switchModule('sandbox');
  assert.deepEqual((await store.status()).active.version, { kind: 'default' });
  const switchedBack = await store.switchModule('s1-1');
  assert.equal(switchedBack.active.version.kind, 'snapshot');
  assert.equal(switchedBack.active.version.snapshotId, saved.snapshot.id);
  assert.ok(readProjectFile(ROOT_DIR, 'src/app.module.ts').includes('MARKER'));
  step('switching back to a module restores its last used snapshot');

  const loadedDefault = await store.loadVersion('default');
  assert.deepEqual(loadedDefault.active.version, { kind: 'default' });
  assert.ok(readProjectFile(ROOT_DIR, 'src/app.module.ts').includes('S1-1'));
  step('loadVersion(default) restored the module default code');
  // #endregion

  // #region deleteSnapshot
  await store.loadVersion('snapshot', saved.snapshot.id);
  await assert.rejects(
    () => store.deleteSnapshot(saved.snapshot.id),
    /当前正在使用该版本，先切换到其他版本/,
  );
  await store.loadVersion('default');
  const deleted = await store.deleteSnapshot(saved.snapshot.id);
  assert.equal(deleted.ok, true);
  assert.ok(!fs.existsSync(snapshotRoot), 'snapshot directory must be removed');
  await assert.rejects(() => store.deleteSnapshot(saved.snapshot.id), /代码版本不存在/);
  assert.equal((await store.listModules()).modules[1].snapshots.length, 0);
  step('deleteSnapshot refuses the active version and removes unused ones');

  // The name is reusable after deletion.
  const savedAgain = await store.saveSnapshot('我的实现');
  await store.loadVersion('default');
  await store.deleteSnapshot(savedAgain.snapshot.id);
  step('deleted snapshot names can be reused');
  // #endregion

  // #region resetActive
  await runtime.writeFile('src/app.module.ts', "export const MARKER = 'DIRTY';\n");
  await runtime.createEntry('src/scratch', 'dir');
  store.markDirty();
  const reset = await store.resetActive();
  assert.deepEqual(reset.active.version, { kind: 'default' });
  assert.equal(reset.active.dirty, false);
  assert.ok(readProjectFile(ROOT_DIR, 'src/app.module.ts').includes('S1-1'));
  assert.ok(!projectFileExists(ROOT_DIR, 'src/scratch'), 'reset must drop edited files');
  assert.equal(readStateFile().versions['s1-1'].kind, 'default');
  step('resetActive restored the module default and cleared dirty');
  // #endregion

  // #region serialized mutations
  const [firstSwitch, secondSwitch] = await Promise.all([
    store.switchModule('sandbox'),
    store.switchModule('s1-1'),
  ]);
  assert.equal(firstSwitch.active.moduleId, 'sandbox');
  assert.equal(secondSwitch.active.moduleId, 's1-1');
  const afterRaceStatus = await store.status();
  assert.ok(['sandbox', 's1-1'].includes(afterRaceStatus.active.moduleId));
  assert.equal(readStateFile().activeModuleId, afterRaceStatus.active.moduleId);
  assert.ok(
    projectFileExists(ROOT_DIR, 'src/app.module.ts'),
    'serialized switches must always leave a complete workspace',
  );

  const [firstSave, secondSave] = await Promise.all([
    store.saveSnapshot('并发 A'),
    store.saveSnapshot('并发 B'),
  ]);
  assert.notEqual(firstSave.snapshot.id, secondSave.snapshot.id, 'concurrent snapshots must get unique ids');
  const concurrentListing = await store.listModules();
  assert.equal(concurrentListing.modules[1].snapshots.length, 2);
  await store.loadVersion('default');
  await store.deleteSnapshot(firstSave.snapshot.id);
  await store.deleteSnapshot(secondSave.snapshot.id);
  step('concurrent switch/save operations are serialized without corruption');
  // #endregion

  // #region state file robustness
  const persisted = new createProjectStore({
    pluginRoot: TMP_ROOT,
    rootDir: ROOT_DIR,
    templateDir: TEMPLATE_DIR,
    modulesDir: MODULES_DIR,
    savesDir: SAVES_DIR,
    stateFile: STATE_FILE,
    runtime,
  });
  const persistedStatus = await persisted.status();
  assert.equal(persistedStatus.active.moduleId, 's1-1');
  assert.deepEqual(persistedStatus.active.version, { kind: 'default' });
  assert.equal(persistedStatus.active.dirty, false);
  step('a new store instance reads the persisted active module');

  writeProjectFile(ROOT_DIR, 'src/keep-marker.ts', '// do not touch\n');
  fs.writeFileSync(STATE_FILE, 'this is not json {{', 'utf8');
  const corruptStore = createProjectStore({
    pluginRoot: TMP_ROOT,
    rootDir: ROOT_DIR,
    templateDir: TEMPLATE_DIR,
    modulesDir: MODULES_DIR,
    savesDir: SAVES_DIR,
    stateFile: STATE_FILE,
    runtime,
  });
  const corruptStatus = await corruptStore.status();
  assert.equal(corruptStatus.active.moduleId, 'sandbox', 'corrupt state falls back to sandbox');
  assert.deepEqual(corruptStatus.active.version, { kind: 'default' });
  assert.equal(corruptStatus.active.dirty, false);
  const corruptEnsured = await corruptStore.ensure();
  assert.equal(corruptEnsured.ok, true);
  assert.ok(projectFileExists(ROOT_DIR, 'src/keep-marker.ts'), 'corrupt state must not touch the workspace');
  assert.equal(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).activeModuleId, 'sandbox');
  step('corrupt state file falls back to sandbox/default and is repaired');

  fs.rmSync(STATE_FILE, { force: true });
  const missingStore = createProjectStore({
    pluginRoot: TMP_ROOT,
    rootDir: ROOT_DIR,
    templateDir: TEMPLATE_DIR,
    modulesDir: MODULES_DIR,
    savesDir: SAVES_DIR,
    stateFile: STATE_FILE,
    runtime,
  });
  const missingEnsured = await missingStore.ensure();
  assert.equal(missingEnsured.active.moduleId, 'sandbox');
  assert.ok(fs.existsSync(STATE_FILE), 'ensure must write a state file when it is missing');
  step('missing state file is recreated with sandbox/default');

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      { version: 1, activeModuleId: 'removed-module', dirty: true, versions: { 'not an id': { kind: 'default' } } },
      null,
      2,
    ),
    'utf8',
  );
  const staleStore = createProjectStore({
    pluginRoot: TMP_ROOT,
    rootDir: ROOT_DIR,
    templateDir: TEMPLATE_DIR,
    modulesDir: MODULES_DIR,
    savesDir: SAVES_DIR,
    stateFile: STATE_FILE,
    runtime,
  });
  const staleActive = await staleStore.ensure();
  assert.equal(staleActive.active.moduleId, 'sandbox', 'unknown active module falls back to sandbox');
  step('unknown active module in state file falls back to sandbox');
  // #endregion

  // #region runtime §11 + replaceFrom / captureTo
  step('--- runtime replaceFrom / captureTo and SPEC §11 fixes ---');
  const runtime2 = createPlaygroundRuntime({
    rootDir: RUNTIME_ROOT,
    templateDir: TEMPLATE_DIR,
    nodePath: process.execPath,
    log(line) {
      logs.push(line);
    },
  });
  try {
    const ensuredRuntime = await runtime2.ensure();
    assert.equal(ensuredRuntime.ok, true, String(ensuredRuntime.error));
    const initialFiles = await runtime2.listFiles();
    assert.ok(initialFiles.files.some((file) => file.path === 'src/app.module.ts'));

    // §11.11: listFiles must be read-only (no template self-heal).
    await runtime2.deleteEntry('src/app.module.ts');
    const afterDelete = await runtime2.listFiles();
    assert.ok(
      !afterDelete.files.some((file) => file.path === 'src/app.module.ts'),
      'listFiles must not resurrect a deleted src/app.module.ts',
    );
    await assert.rejects(() => runtime2.readFile('src/app.module.ts'), /文件不存在/);
    await runtime2.replaceFrom(TEMPLATE_DIR);
    assert.ok(projectFileExists(RUNTIME_ROOT, 'src/app.module.ts'));
    step('listFiles is read-only (deleted app.module.ts stays deleted)');

    // §11.12: deleteEntry protection list.
    for (const protectedPath of ['src', 'package.json', 'tsconfig.json', 'build', 'runner.cjs']) {
      await assert.rejects(() => runtime2.deleteEntry(protectedPath), /不允许删除受保护的路径|只允许删除/, protectedPath);
    }
    await assert.rejects(() => runtime2.deleteEntry('../outside.txt'), /\.\./);
    assert.ok(projectFileExists(RUNTIME_ROOT, 'package.json'));
    step('deleteEntry refuses src, root config, build, runner.cjs and paths outside src/');

    // §11.13: the src/ walk skips node_modules/ and build/.
    fs.mkdirSync(path.join(RUNTIME_ROOT, 'src', 'node_modules'), { recursive: true });
    fs.mkdirSync(path.join(RUNTIME_ROOT, 'src', 'build'), { recursive: true });
    fs.writeFileSync(path.join(RUNTIME_ROOT, 'src', 'build', 'compiled.js'), '// js\n', 'utf8');
    fs.mkdirSync(path.join(RUNTIME_ROOT, 'src', 'real-dir'), { recursive: true });
    const filtered = await runtime2.listFiles();
    assert.ok(filtered.dirs.some((dir) => dir.path === 'src/real-dir'));
    assert.ok(!filtered.dirs.some((dir) => dir.path === 'src/node_modules'));
    assert.ok(!filtered.dirs.some((dir) => dir.path === 'src/build'));
    step('listFiles walk skips src/node_modules and src/build');

    // captureTo: copies only the project files, replaces the target, skips artifacts.
    fs.mkdirSync(path.join(RUNTIME_ROOT, 'build'), { recursive: true });
    fs.writeFileSync(path.join(RUNTIME_ROOT, 'build', 'stale.js'), '// build\n', 'utf8');
    fs.writeFileSync(path.join(RUNTIME_ROOT, 'runner.cjs'), '// runner\n', 'utf8');
    fs.mkdirSync(path.join(RUNTIME_ROOT, '.git'), { recursive: true });
    fs.writeFileSync(path.join(RUNTIME_ROOT, '.git', 'config'), '[core]\n', 'utf8');
    fs.writeFileSync(path.join(RUNTIME_ROOT, '.DS_Store'), 'junk', 'utf8');
    fs.writeFileSync(path.join(RUNTIME_ROOT, 'src', 'partial.ts.tmp-9-9'), '// partial\n', 'utf8');
    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CAPTURE_DIR, 'stale.txt'), 'stale\n', 'utf8');
    const captured = await runtime2.captureTo(CAPTURE_DIR);
    assert.equal(captured.ok, true);
    const capturedPaths = captured.files;
    assert.ok(capturedPaths.includes('package.json'));
    assert.ok(capturedPaths.includes('src/app.module.ts'));
    assert.ok(capturedPaths.includes('src/cats/cats.service.ts'));
    assert.ok(!capturedPaths.some((file) => file.startsWith('build/')));
    assert.ok(!capturedPaths.includes('runner.cjs'));
    assert.ok(!capturedPaths.some((file) => file.startsWith('.git/')));
    assert.ok(!capturedPaths.includes('.DS_Store'));
    assert.ok(!capturedPaths.some((file) => file.includes('.tmp-')));
    assert.ok(!fs.existsSync(path.join(CAPTURE_DIR, 'stale.txt')), 'captureTo must clear the target first');
    await assert.rejects(() => runtime2.captureTo('relative/target'), /绝对路径/);
    await assert.rejects(() => runtime2.captureTo(RUNTIME_ROOT), /重叠/);
    await assert.rejects(() => runtime2.captureTo(path.dirname(RUNTIME_ROOT)), /重叠/);
    step('captureTo copies the project, clears the target and skips runtime artifacts');

    // replaceFrom: swaps the workspace and removes stale module files.
    writeProjectFile(REPLACEMENT_DIR, 'package.json', '{"name":"replacement"}\n');
    writeProjectFile(REPLACEMENT_DIR, 'tsconfig.json', '{"compilerOptions":{}}\n');
    writeProjectFile(REPLACEMENT_DIR, 'src/app.module.ts', "export const MARKER = 'REPLACED';\n");
    writeProjectFile(REPLACEMENT_DIR, 'src/build/skip.js', '// skipped\n');
    writeProjectFile(REPLACEMENT_DIR, 'runner.cjs', '// skipped\n');
    writeProjectFile(REPLACEMENT_DIR, 'node_modules/skip/index.js', '// skipped\n');
    writeProjectFile(REPLACEMENT_DIR, '.git/config', '[core]\n');
    const replaced = await runtime2.replaceFrom(REPLACEMENT_DIR);
    assert.equal(replaced.ok, true);
    assert.ok(replaced.files.includes('src/app.module.ts'));
    assert.ok(!replaced.files.includes('runner.cjs'));
    assert.ok(readProjectFile(RUNTIME_ROOT, 'src/app.module.ts').includes('REPLACED'));
    assert.ok(!projectFileExists(RUNTIME_ROOT, 'src/cats/cats.service.ts'), 'old sources are cleared');
    assert.ok(!projectFileExists(RUNTIME_ROOT, 'build/stale.js'), 'build/ is cleared');
    assert.ok(!projectFileExists(RUNTIME_ROOT, 'runner.cjs'), 'runner.cjs is cleared');
    await assert.rejects(() => runtime2.replaceFrom(path.join(TMP_ROOT, 'missing-dir')), /模板目录不存在/);
    step('replaceFrom swaps the workspace, clears build/runner and validates the source dir');

    const resetResult = await runtime2.reset();
    assert.equal(resetResult.ok, true, String(resetResult.error));
    assert.ok(resetResult.files.length > 0);
    assert.ok(readProjectFile(RUNTIME_ROOT, 'src/app.module.ts').includes('AppModule'));
    step('reset() still restores the original template via replaceFrom');
  } finally {
    runtime2.dispose();
  }
  // #endregion

  passed = true;
  console.log('');
  console.log('PASS playground-projects.test.mjs');
} catch (error) {
  console.error('FAIL playground-projects.test.mjs');
  console.error(error && error.stack ? error.stack : String(error));
  if (logs.length > 0) console.error('runtime log tail:\n' + logs.slice(-30).join('\n'));
  process.exitCode = 1;
} finally {
  try {
    runtime.dispose();
  } catch (_error) {
    /* dispose is best-effort */
  }
  cleanRoot(ROOT_DIR);
  cleanRoot(RUNTIME_ROOT);
  try {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
    assert.ok(fs.existsSync(path.join(PLUGIN_NODE_MODULES, '@nestjs', 'core')));
    console.log('[test] temp root removed; plugin node_modules untouched');
  } catch (cleanupError) {
    cleanupFailed = true;
    console.error(
      'FAIL cleanup: ' + String(cleanupError && cleanupError.message ? cleanupError.message : cleanupError),
    );
    process.exitCode = 1;
  }
}

if (!passed || cleanupFailed) {
  process.exitCode = 1;
  if (passed) console.error('FAIL playground-projects.test.mjs (cleanup)');
}
