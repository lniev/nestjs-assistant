/**
 * Standalone verification for the NestJS playground runtime.
 *
 * Run with: node host/playground-runtime.test.mjs
 *
 * The script creates an isolated playground under os.tmpdir(), exercises the
 * real TypeScript compile + Nest boot + HTTP proxy pipeline, checks the failure
 * path for compiler errors, and always cleans up its temporary directory.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlaygroundRuntime } from './playground-runtime.js';

const HOST_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(HOST_DIR, 'playground-template');
const PLUGIN_NODE_MODULES = path.resolve(HOST_DIR, '..', 'node_modules');
const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-assistant-playground-test-'));

const runtimeLog = [];
let runtime = null;
let activeRunId = null;
let passed = false;
let cleanupFailed = false;

/** Print one progress checkpoint. */
function step(message) {
  console.log('[test] ' + message);
}

/** Wait until a run reaches one of the wanted statuses. */
async function waitForStatus(runId, wanted, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await runtime.poll(runId);
    if (wanted.includes(latest.status)) return latest;
    if (latest.status === 'failed' || latest.status === 'stopped') {
      throw new Error(
        'run ' +
          runId +
          ' ended as ' +
          latest.status +
          ' while waiting for ' +
          wanted.join('/') +
          '\nerror: ' +
          String(latest.error) +
          '\nlogs:\n' +
          latest.logs.join('\n'),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    'timed out after ' +
      String(timeoutMs) +
      'ms waiting for ' +
      wanted.join('/') +
      ' (last status: ' +
      (latest === null ? 'none' : latest.status) +
      ')\nlogs:\n' +
      (latest === null ? '' : latest.logs.join('\n')),
  );
}

/** Remove the temp playground without ever following the node_modules symlink. */
function cleanRoot() {
  const link = path.join(rootDir, 'node_modules');
  try {
    if (fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
  } catch (_error) {
    /* no link */
  }
  fs.rmSync(rootDir, { recursive: true, force: true });
}

try {
  step('node ' + process.version + ' (' + process.execPath + ')');
  step('temp root ' + rootDir);

  runtime = createPlaygroundRuntime({
    rootDir,
    templateDir: TEMPLATE_DIR,
    nodePath: process.execPath,
    log(line) {
      runtimeLog.push(line);
    },
  });

  const initialStatus = await runtime.status();
  assert.equal(initialStatus.rootDir, rootDir);
  assert.equal(initialStatus.nodePath, process.execPath);
  assert.equal(initialStatus.depsOk, true, 'missing deps: ' + initialStatus.missingDeps.join(', '));
  assert.deepEqual(initialStatus.missingDeps, []);
  assert.equal(initialStatus.activeRunId, null);
  assert.equal(initialStatus.activeStatus, null);
  step('status ok (depsOk=true)');

  const ensured = await runtime.ensure();
  assert.equal(ensured.ok, true, String(ensured.error));
  assert.equal(ensured.initialized, true);
  assert.equal(ensured.depsOk, true);
  assert.ok(fs.existsSync(path.join(rootDir, 'src', 'app.module.ts')));
  assert.ok(fs.existsSync(path.join(rootDir, 'src', 'cats', 'cats.controller.ts')));
  assert.ok(fs.existsSync(path.join(rootDir, 'package.json')));
  assert.ok(fs.existsSync(path.join(rootDir, 'tsconfig.json')));
  const modulesLink = fs.lstatSync(path.join(rootDir, 'node_modules'));
  assert.equal(modulesLink.isSymbolicLink(), true, 'temp playground should link plugin node_modules');
  assert.ok(fs.existsSync(path.join(rootDir, 'node_modules', '@nestjs', 'core')));
  step('ensure copied template and linked dependencies');

  const fileList = await runtime.listFiles();
  const filePaths = fileList.files.map((file) => file.path);
  assert.ok(filePaths.includes('src/app.module.ts'));
  assert.ok(filePaths.includes('src/cats/cats.service.ts'));
  assert.ok(filePaths.includes('package.json'));
  assert.ok(filePaths.includes('tsconfig.json'));
  assert.ok(!filePaths.some((file) => file.startsWith('build/')));
  assert.ok(!filePaths.some((file) => file.startsWith('node_modules/')));
  assert.ok(!filePaths.includes('runner.cjs'));
  assert.ok(fileList.files.every((file) => typeof file.size === 'number' && file.mtime > 0));
  const dirPaths = fileList.dirs.map((dir) => dir.path);
  assert.ok(dirPaths.includes('src'));
  assert.ok(dirPaths.includes('src/cats'));
  assert.ok(!dirPaths.some((dir) => dir.startsWith('build/')));
  assert.ok(!dirPaths.some((dir) => dir.startsWith('node_modules/')));
  step('listFiles returned ' + String(filePaths.length) + ' editable files and ' + String(dirPaths.length) + ' directories');

  const serviceText = await runtime.readFile('src/cats/cats.service.ts');
  assert.equal(serviceText.path, 'src/cats/cats.service.ts');
  assert.ok(serviceText.content.includes("@Injectable()"));

  await runtime.writeFile('src/note.ts', 'export const note = 1;\n');
  const note = await runtime.readFile('src/note.ts');
  assert.equal(note.content, 'export const note = 1;\n');
  await runtime.deleteEntry('src/note.ts');
  await assert.rejects(() => runtime.readFile('src/note.ts'), /文件不存在/);

  await runtime.createEntry('src/tmp-dir', 'dir');
  const afterDir = await runtime.listFiles();
  assert.ok(afterDir.dirs.some((dir) => dir.path === 'src/tmp-dir'), 'empty directories must be listed');
  await runtime.createEntry('src/tmp-dir/tmp.ts', 'file');
  assert.equal((await runtime.readFile('src/tmp-dir/tmp.ts')).content, '');
  await runtime.deleteEntry('src/tmp-dir');
  await assert.rejects(() => runtime.readFile('src/tmp-dir/tmp.ts'), /文件不存在/);
  step('readFile / writeFile / createEntry / deleteEntry round-trip ok');

  await assert.rejects(() => runtime.readFile('../outside.txt'), /\.\./);
  await assert.rejects(() => runtime.writeFile('/tmp/outside.txt', 'x'), /相对路径/);
  await assert.rejects(
    () => runtime.writeFile('src/too-big.ts', 'x'.repeat(512 * 1024 + 1)),
    /512KB/,
  );
  await assert.rejects(() => runtime.readFile('node_modules/@nestjs/core/package.json'), /node_modules/);
  step('path safety and 512KB limit rejected invalid input');

  const started = await runtime.start();
  activeRunId = started.runId;
  assert.equal(typeof activeRunId, 'string');
  assert.ok(activeRunId.length > 0);
  const running = await waitForStatus(activeRunId, ['running']);
  assert.equal(running.status, 'running');
  assert.equal(typeof running.url, 'string');
  assert.ok(running.url.startsWith('http://127.0.0.1:'));
  assert.equal(running.error, null);
  assert.ok(running.endedAt === null);
  assert.ok(running.logs.length > 0);
  assert.ok(!running.logs.some((line) => line.includes('##NEST_READY##')));
  assert.ok(fs.existsSync(path.join(rootDir, 'runner.cjs')));
  const buildPackage = JSON.parse(fs.readFileSync(path.join(rootDir, 'build', 'package.json'), 'utf8'));
  assert.equal(buildPackage.type, 'commonjs');
  const routes = running.routes.map((route) => route.method + ' ' + route.path);
  assert.ok(routes.includes('GET /cats'), routes.join(', '));
  assert.ok(routes.includes('GET /cats/:id'), routes.join(', '));
  assert.ok(routes.includes('POST /cats'), routes.join(', '));
  step('start -> running at ' + running.url + ' (' + routes.join(', ') + ')');

  const runningStatus = await runtime.status();
  assert.equal(runningStatus.activeRunId, activeRunId);
  assert.equal(runningStatus.activeStatus, 'running');

  const listResponse = await runtime.request(activeRunId, { method: 'GET', path: '/cats' });
  assert.equal(listResponse.status, 200, JSON.stringify(listResponse));
  assert.ok(String(listResponse.headers['content-type']).includes('application/json'));
  assert.equal(typeof listResponse.statusText, 'string');
  assert.equal(typeof listResponse.timeMs, 'number');
  const seededCats = JSON.parse(listResponse.body);
  assert.ok(Array.isArray(seededCats));
  assert.equal(seededCats.length, 2);
  assert.equal(seededCats[0].name, 'Tom');
  step('GET /cats -> 200 with ' + String(seededCats.length) + ' seeded cats');

  const oneResponse = await runtime.request(activeRunId, { method: 'GET', path: '/cats/1' });
  assert.equal(oneResponse.status, 200, JSON.stringify(oneResponse));
  assert.equal(JSON.parse(oneResponse.body).id, 1);

  const missingResponse = await runtime.request(activeRunId, { method: 'GET', path: '/cats/999' });
  assert.equal(missingResponse.status, 404, JSON.stringify(missingResponse));

  const createResponse = await runtime.request(activeRunId, {
    method: 'POST',
    path: '/cats',
    body: JSON.stringify({ name: 'Milo', age: 4 }),
  });
  assert.equal(createResponse.status, 201, JSON.stringify(createResponse));
  const created = JSON.parse(createResponse.body);
  assert.equal(created.id, 3);
  assert.equal(created.name, 'Milo');
  assert.equal(created.age, 4);

  const afterCreate = await runtime.request(activeRunId, { method: 'GET', path: '/cats' });
  assert.equal(JSON.parse(afterCreate.body).length, 3);
  step('GET /cats/:id, 404, POST /cats -> 201 and JSON round-trip ok');

  const stopped = await runtime.stop(activeRunId);
  assert.equal(stopped.ok, true);
  const stoppedSnapshot = await runtime.poll(activeRunId);
  assert.equal(stoppedSnapshot.status, 'stopped');
  const statusAfterStop = await runtime.status();
  assert.equal(statusAfterStop.activeRunId, null);
  assert.equal(statusAfterStop.activeStatus, null);
  activeRunId = null;
  step('stop -> stopped, active run cleared');

  await runtime.writeFile('src/broken.ts', 'export const broken: number = "not a number";\n');
  const brokenStarted = await runtime.start();
  const brokenRunId = brokenStarted.runId;
  const failed = await waitForStatus(brokenRunId, ['failed']);
  assert.equal(failed.error, 'TypeScript 编译失败');
  assert.ok(
    failed.logs.some((line) => /src\/broken\.ts\(\d+,\d+\): error TS\d+: /.test(line)),
    failed.logs.join('\n'),
  );
  assert.ok(failed.logs.some((line) => line.includes('error TS2322')));
  assert.equal(failed.routes.length, 0);
  step('compile error path -> failed with formatted diagnostics');
  await runtime.deleteEntry('src/broken.ts');

  await runtime.writeFile('src/extra.txt', 'will be removed by reset');
  await runtime.deleteEntry('src/cats/cats.controller.ts');
  const reset = await runtime.reset();
  assert.equal(reset.ok, true, String(reset.error));
  assert.ok(reset.files.includes('src/cats/cats.controller.ts'));
  assert.ok(fs.existsSync(path.join(rootDir, 'src', 'cats', 'cats.controller.ts')));
  assert.ok(!fs.existsSync(path.join(rootDir, 'src', 'extra.txt')));
  assert.ok(fs.existsSync(path.join(rootDir, 'node_modules', '@nestjs', 'core')));
  assert.ok(!fs.existsSync(path.join(rootDir, 'build')));
  assert.ok(!fs.existsSync(path.join(rootDir, 'runner.cjs')));
  step('reset restored template and kept node_modules intact');

  runtime.dispose();
  runtime.dispose();
  step('dispose is idempotent');
  passed = true;
} catch (error) {
  console.error('FAIL playground-runtime.test.mjs');
  console.error(error && error.stack ? error.stack : String(error));
  if (runtime !== null && activeRunId !== null) {
    try {
      const latest = await runtime.poll(activeRunId);
      console.error('last run status: ' + latest.status);
      console.error(latest.logs.slice(-40).join('\n'));
    } catch (_pollError) {
      /* best-effort diagnostics */
    }
  }
  process.exitCode = 1;
} finally {
  if (runtime !== null) {
    try {
      await runtime.stop();
    } catch (_error) {
      /* best-effort */
    }
    try {
      runtime.dispose();
    } catch (_error) {
      /* best-effort */
    }
  }
  try {
    cleanRoot();
    assert.ok(fs.existsSync(path.join(PLUGIN_NODE_MODULES, '@nestjs', 'core')));
    console.log('[test] temp root removed; plugin node_modules untouched');
  } catch (cleanupError) {
    cleanupFailed = true;
    console.error('FAIL cleanup: ' + String(cleanupError && cleanupError.message ? cleanupError.message : cleanupError));
    process.exitCode = 1;
  }
}

if (passed && !cleanupFailed) {
  console.log('PASS playground-runtime.test.mjs');
} else {
  process.exitCode = 1;
  if (passed) console.error('FAIL playground-runtime.test.mjs (cleanup)');
}
