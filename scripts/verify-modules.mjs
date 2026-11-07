// Verify every playground module's default project: the real TypeScript compile
// + Nest boot + HTTP pipeline from host/playground-runtime.js, one isolated
// temporary playground per module.
//
// Usage:
//   node scripts/verify-modules.mjs                 # verify every module
//   node scripts/verify-modules.mjs --list          # list module ids
//   node scripts/verify-modules.mjs --only=s1-1,s1-2
//   node scripts/verify-modules.mjs --stage=s1,s2
//   node scripts/verify-modules.mjs --jobs=2 --keep
//
// Contract (see MODULES-SPEC.md): each module directory holds `module.json` and
// a `default/` starter project. `module.json.routes` lists the HTTP routes the
// starter must expose; `GET /health` returning `{ "status": "ok", ... }` is
// mandatory. The script creates only temporary directories outside the plugin
// and never touches the user's playground/ directory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlaygroundRuntime } from '../host/playground-runtime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_DIR = path.join(ROOT, 'playground-modules');
const START_TIMEOUT_MS = 90000;

function argValue(name) {
	// Support both `--name=value` and `--name value`.
	const prefix = '--' + name + '=';
	for (const arg of process.argv) {
		if (typeof arg === 'string' && arg.startsWith(prefix)) return arg.slice(prefix.length);
	}
	const index = process.argv.indexOf('--' + name);
	if (index < 0) return null;
	const value = process.argv[index + 1];
	return typeof value === 'string' && value.startsWith('--') ? '' : value === undefined ? '' : value;
}

function hasFlag(name) {
	return process.argv.includes('--' + name);
}

function listModuleIds() {
	let entries;
	try {
		entries = fs.readdirSync(MODULES_DIR, { withFileTypes: true });
	} catch (_error) {
		return [];
	}
	const ids = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
		const manifest = path.join(MODULES_DIR, entry.name, 'module.json');
		if (fs.existsSync(manifest)) ids.push(entry.name);
	}
	return ids.sort();
}

function readManifest(id) {
	const file = path.join(MODULES_DIR, id, 'module.json');
	let raw;
	try {
		raw = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (error) {
		return { ok: false, error: 'module.json 无法解析：' + String(error && error.message ? error.message : error) };
	}
	if (raw === null || typeof raw !== 'object') return { ok: false, error: 'module.json 必须是对象' };
	if (raw.id !== id) return { ok: false, error: 'module.json 的 id（' + String(raw.id) + '）与目录名不一致' };
	if (typeof raw.titleZh !== 'string' || raw.titleZh.trim() === '') return { ok: false, error: 'module.json 缺少 titleZh' };
	if (typeof raw.summary !== 'string' || raw.summary.trim() === '') return { ok: false, error: 'module.json 缺少 summary（说明这套默认代码练什么）' };
	const routes = Array.isArray(raw.routes) ? raw.routes : null;
	if (routes === null || routes.length === 0) return { ok: false, error: 'module.json 缺少 routes（至少列出 /health）' };
	for (const route of routes) {
		if (route === null || typeof route !== 'object' || typeof route.path !== 'string' || !/^\/[^\s]*$/.test(route.path)) {
			return { ok: false, error: 'module.json.routes 里有非法条目：' + JSON.stringify(route) };
		}
		if (route.method !== undefined && typeof route.method !== 'string') return { ok: false, error: 'routes.method 必须是字符串' };
		if (route.expect !== undefined && !Number.isInteger(route.expect)) return { ok: false, error: 'routes.expect 必须是整数状态码' };
	}
	if (!routes.some((route) => route.expect === 200)) {
		return { ok: false, error: 'routes 至少要有一条 expect: 200 的路由（用于冒烟验证）' };
	}
	const defaultDir = path.join(MODULES_DIR, id, 'default');
	for (const required of ['package.json', 'tsconfig.json', path.join('src', 'app.module.ts')]) {
		if (!fs.existsSync(path.join(defaultDir, required))) return { ok: false, error: 'default/ 缺少 ' + required };
	}
	const defaultFile = typeof raw.defaultFile === 'string' && raw.defaultFile !== '' ? raw.defaultFile : 'src/app.module.ts';
	return { ok: true, manifest: raw, defaultDir, defaultFile };
}

function countFiles(dir) {
	let total = 0;
	const walk = (current) => {
		let entries;
		try {
			entries = fs.readdirSync(current, { withFileTypes: true });
		} catch (_error) {
			return;
		}
		for (const entry of entries) {
			if (entry.name === 'node_modules' || entry.name === 'build') continue;
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) walk(absolute);
			else total += 1;
		}
	};
	walk(dir);
	return total;
}

function tail(text, limit) {
	const value = String(text === undefined || text === null ? '' : text);
	return value.length <= limit ? value : '…' + value.slice(value.length - limit);
}

async function waitForRunning(runtime, runId, deadline) {
	let latest = null;
	while (Date.now() < deadline) {
		latest = await runtime.poll(runId);
		if (latest.status === 'running') return { ok: true, run: latest };
		if (latest.status === 'failed' || latest.status === 'stopped') {
			return {
				ok: false,
				error: '启动' + (latest.status === 'failed' ? '失败' : '后立即停止') + '：' + String(latest.error || '') + '\n' + tail(latest.logs.join('\n'), 2000)
			};
		}
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
	return { ok: false, error: '启动超时（' + String(Math.round((Date.now() - (deadline - START_TIMEOUT_MS)) / 1000)) + 's）\n' + tail(latest === null ? '' : latest.logs.join('\n'), 2000) };
}

async function verifyModule(id) {
	const read = readManifest(id);
	if (!read.ok) return { id, ok: false, error: read.error };
	const { manifest, defaultDir } = read;
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-assistant-module-' + id + '-'));
	let runtime = null;
	let runId = null;
	try {
		runtime = createPlaygroundRuntime({ rootDir, templateDir: defaultDir, nodePath: process.execPath, log() {} });
		const ensured = await runtime.ensure();
		if (!ensured.ok) return { id, ok: false, error: '初始化失败：' + String(ensured.error) };
		if (!ensured.depsOk) return { id, ok: false, error: '缺少依赖：' + ensured.missingDeps.join(', ') };

		const started = await runtime.start();
		runId = started.runId;
		const running = await waitForRunning(runtime, runId, Date.now() + START_TIMEOUT_MS);
		if (!running.ok) return { id, ok: false, error: running.error };

		const checked = [];
		for (const route of manifest.routes) {
			const method = String(route.method === undefined ? 'GET' : route.method).toUpperCase();
			const requestPath = String(route.path).replace(/:[A-Za-z0-9_]+/g, '1');
			const response = await runtime.request(runId, {
				method,
				path: requestPath,
				body: method === 'GET' || method === 'HEAD' ? undefined : typeof route.body === 'string' ? route.body : '{}'
			});
			const expected = Number.isInteger(route.expect) ? route.expect : null;
			const status = typeof response.status === 'number' ? response.status : 0;
			if (expected !== null ? status !== expected : !(status > 0 && status < 500)) {
				return {
					id,
					ok: false,
					error: method + ' ' + route.path + ' 期望 ' + (expected === null ? '<500' : String(expected)) + '，实际 ' + String(status) +
						(response.error === undefined ? '：' + tail(String(response.body), 400) : '：' + String(response.error))
				};
			}
			checked.push(method + ' ' + route.path);
		}
		return {
			id,
			ok: true,
			title: manifest.titleZh,
			stageId: manifest.stageId,
			files: countFiles(defaultDir),
			routes: checked,
			logs: running.run.logs
		};
	} catch (error) {
		return { id, ok: false, error: String(error && error.stack ? error.stack : error) };
	} finally {
		try {
			if (runtime !== null) {
				if (runId !== null) await runtime.stop(runId);
				runtime.dispose();
			}
		} catch (_error) {
			/* best-effort */
		}
		if (!hasFlag('keep')) cleanupRoot(rootDir);
	}
}

/** Remove a temp playground without following the node_modules symlink. */
function cleanupRoot(rootDir) {
	try {
		const link = path.join(rootDir, 'node_modules');
		if (fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
	} catch (_error) {
		/* no link */
	}
	try {
		fs.rmSync(rootDir, { recursive: true, force: true });
	} catch (_error) {
		/* best-effort */
	}
}

async function main() {
	if (hasFlag('list')) {
		for (const id of listModuleIds()) console.log(id);
		return 0;
	}
	const only = argValue('only');
	const stage = argValue('stage');
	let ids = listModuleIds();
	if (only !== null && only !== '') {
		const wanted = only.split(',').map((value) => value.trim()).filter(Boolean);
		const unknown = wanted.filter((id) => ids.indexOf(id) < 0);
		if (unknown.length > 0) {
			console.error('未知模块：' + unknown.join(', '));
			return 2;
		}
		ids = wanted;
	} else if (stage !== null && stage !== '') {
		const wanted = stage.split(',').map((value) => value.trim()).filter(Boolean);
		ids = ids.filter((id) => {
			const read = readManifest(id);
			return read.ok && wanted.indexOf(String(read.manifest.stageId)) >= 0;
		});
	}
	if (ids.length === 0) {
		console.error('没有找到可验证的模块（playground-modules/<id>/module.json）');
		return 2;
	}
	const jobs = Math.max(1, Math.min(4, Number.parseInt(argValue('jobs') || '1', 10) || 1));
	console.log('[verify] ' + String(ids.length) + ' module(s), jobs=' + String(jobs));
	const results = [];
	let cursor = 0;
	const worker = async () => {
		while (cursor < ids.length) {
			const id = ids[cursor];
			cursor += 1;
			const result = await verifyModule(id);
			if (result.ok) {
				console.log('  PASS ' + result.id.padEnd(6) + ' ' + String(result.title) + ' · ' + String(result.files) + ' files · ' + result.routes.join(', '));
			} else {
				console.log('  FAIL ' + result.id + ' -> ' + String(result.error));
			}
			results.push(result);
		}
	};
	await Promise.all(Array.from({ length: Math.min(jobs, ids.length) }, () => worker()));
	const failed = results.filter((result) => !result.ok);
	if (failed.length === 0) {
		console.log('PASS ' + String(results.length) + '/' + String(ids.length) + ' modules verified');
		return 0;
	}
	console.log('FAIL ' + String(failed.length) + '/' + String(ids.length) + ' modules: ' + failed.map((result) => result.id).join(', '));
	return 1;
}

process.exitCode = await main();
