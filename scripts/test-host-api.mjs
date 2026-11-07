// Host API integration test: drives the plugin's Host half (`index.js`) with a
// fake Cordis context and mock HTTP requests, no browser and no DSH needed.
//
// It verifies the same-origin API the panel calls:
//   GET  /status        knowledge availability + runtime facts
//   GET  /kb            full knowledge base payload
//   GET  /playground/files, /playground/file
//   PUT  /playground/file / POST /playground/run / GET /playground/poll
//   POST /playground/request / POST /playground/stop
//   GET  /playground/modules
//   POST /playground/module  / POST /playground/version
//   POST /playground/snapshot / DELETE /playground/snapshot
//   POST /playground/reset   (module aware)
//
// The playground-module section switches modules, saves/loads/deletes one
// snapshot and restores the original active module (and state file) afterwards,
// removing every snapshot directory it created.
//
// Usage: node scripts/test-host-api.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
let checks = 0;
function check(name, condition, detail) {
	checks += 1;
	if (condition) console.log('  ok   ' + name);
	else {
		failures += 1;
		console.log('  FAIL ' + name + (detail === undefined ? '' : ' -> ' + detail));
	}
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const routes = [];
const tools = [];
const promptSections = [];
const disposers = [];
const fakeCtx = {
	effect(callback, label) {
		const dispose = callback();
		disposers.push({ label, dispose: typeof dispose === 'function' ? dispose : null });
		return () => {};
	},
	webServer: {
		register(route) {
			routes.push(route);
			return () => {};
		}
	},
	connection: {
		requestRejection() {
			return undefined;
		}
	},
	tools: {
		register(definition) {
			tools.push(definition);
			return () => {};
		}
	},
	systemPrompt: {
		section(section) {
			promptSections.push(section);
			return () => {};
		}
	},
	get(name) {
		if (name === 'connection') return fakeCtx.connection;
		return undefined;
	},
	logger: { debug() {}, warn() {}, error() {} }
};

/** Run one mock HTTP request against the registered prefix route. */
function request(method, urlPath, body) {
	const route = routes.find((entry) => entry.kind === 'prefix');
	if (route === undefined) throw new Error('no prefix route registered');
	const encoded = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');
	const req = {
		method,
		url: urlPath,
		headers: {},
		on(event, handler) {
			if (event === 'data' && encoded !== null) handler(encoded);
			if (event === 'end') handler();
			return req;
		}
	};
	return new Promise((resolve, reject) => {
		let status = 200;
		let text = '';
		const res = {
			set statusCode(value) {
				status = value;
			},
			get statusCode() {
				return status;
			},
			setHeader() {},
			end(chunk) {
				if (typeof chunk === 'string') text += chunk;
				try {
					resolve({ status, json: text === '' ? null : JSON.parse(text) });
				} catch (error) {
					reject(error);
				}
			}
		};
		const handler = routes.find((entry) => entry.kind === 'prefix').handler;
		Promise.resolve(handler(req, res)).catch(reject);
	});
}

const { apply } = await import(path.join(root, 'index.js'));
let applyError = null;
try {
	apply(fakeCtx);
} catch (error) {
	applyError = error;
}
check('apply() runs', applyError === null, applyError === null ? '' : applyError.stack);
check('registers one prefix API route', routes.length === 1 && routes[0].path === '/nest-assistant/api');
check('registers nest_docs tool', tools.length === 1 && tools[0].name === 'nest_docs');
check('registers prompt guidance', promptSections.length === 1);
check('disposes runtime on unload', disposers.some((entry) => typeof entry.dispose === 'function'));

// Anything this script changes under the real plugin directory is restored in the
// cleanup block below; capture the pristine state file before the first request
// (the first playground request may create it).
const stateFilePath = path.join(root, 'playground-state.json');
const savesDirPath = path.join(root, 'playground-saves');
const originalStateRaw = fs.existsSync(stateFilePath) ? fs.readFileSync(stateFilePath, 'utf8') : null;
const savesExistedOriginally = fs.existsSync(savesDirPath);

const status = await request('GET', '/nest-assistant/api/status');
check('GET /status ok', status.status === 200 && status.json.ok === true);
check('knowledge data is available', status.json.knowledgeReady === true, JSON.stringify(status.json).slice(0, 160));
check('runtime reports a node path', typeof status.json.runtime.nodePath === 'string' && status.json.runtime.nodePath !== '');

const kb = await request('GET', '/nest-assistant/api/kb');
check('GET /kb ok', kb.status === 200 && kb.json.ok === true);
check('GET /kb returns pages', kb.json.knowledge !== undefined && Object.keys(kb.json.knowledge.pages).length > 150);
check('GET /kb returns chapters', Array.isArray(kb.json.knowledge.chapters) && kb.json.knowledge.chapters.length > 20);

const unknown = await request('GET', '/nest-assistant/api/nope');
check('unknown route answers 404 envelope', unknown.status === 404 && unknown.json.ok === false);

const tool = tools[0];
check('tool search returns text', typeof (await tool.execute({ action: 'search', query: '守卫' })) === 'string');
const readResult = await tool.execute({ action: 'read', id: 'controllers' });
check('tool read returns a page', typeof readResult === 'string' && readResult.indexOf('controllers') >= 0);
check('tool list returns catalog', String(await tool.execute({ action: 'list' })).indexOf('##') >= 0);
const mapResult = await tool.execute({ action: 'map' });
const routeResult = await tool.execute({ action: 'route' });
check('tool map returns content or notice', typeof mapResult === 'string' && mapResult.length > 20);
check('tool route returns content or notice', typeof routeResult === 'string' && routeResult.length > 20);
check('tool output render returns text block', Array.isArray(tool.output.render({}, 'hello')) && tool.output.render({}, 'hello')[0].text === 'hello');

const filesResponse = await request('GET', '/nest-assistant/api/playground/files');
check('GET /playground/files ok', filesResponse.status === 200 && filesResponse.json.ok === true);
check('sandbox lists seeded files', Array.isArray(filesResponse.json.files) && filesResponse.json.files.length > 0, JSON.stringify(filesResponse.json).slice(0, 160));

const fileResponse = await request('GET', '/nest-assistant/api/playground/file?path=src/app.module.ts');
check('GET /playground/file reads a file', fileResponse.status === 200 && fileResponse.json.content.indexOf('AppModule') >= 0);

const saved = await request('PUT', '/nest-assistant/api/playground/file', { path: 'src/smoke-temp.ts', content: '// host api smoke test\nexport const value = 1;\n' });
check('PUT /playground/file writes a file', saved.status === 200 && saved.json.ok === true);
const readBack = await request('GET', '/nest-assistant/api/playground/file?path=src/smoke-temp.ts');
check('written file reads back', readBack.status === 200 && readBack.json.content.indexOf('host api smoke') >= 0);
const removed = await request('DELETE', '/nest-assistant/api/playground/entry', { path: 'src/smoke-temp.ts' });
check('DELETE /playground/entry removes the file', removed.status === 200 && removed.json.ok === true);

const madeDir = await request('POST', '/nest-assistant/api/playground/entry', { path: 'src/smoke-temp-dir/nested', kind: 'dir' });
check('POST /playground/entry creates a folder', madeDir.status === 200 && madeDir.json.ok === true, JSON.stringify(madeDir.json).slice(0, 160));
const afterDir = await request('GET', '/nest-assistant/api/playground/files');
check('files listing exposes folders for the sandbox tree', Array.isArray(afterDir.json.dirs) && afterDir.json.dirs.some((dir) => dir.path === 'src/smoke-temp-dir/nested'), JSON.stringify(afterDir.json.dirs === undefined ? null : afterDir.json.dirs).slice(0, 200));
const removedDir = await request('DELETE', '/nest-assistant/api/playground/entry', { path: 'src/smoke-temp-dir' });
check('DELETE /playground/entry removes the folder', removedDir.status === 200 && removedDir.json.ok === true);

const started = await request('POST', '/nest-assistant/api/playground/run', {});
check('POST /playground/run returns a runId', started.status === 200 && typeof started.json.runId === 'string', JSON.stringify(started.json).slice(0, 200));
let poll = null;
let running = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
	await sleep(500);
	const polled = await request('GET', '/nest-assistant/api/playground/poll?runId=' + encodeURIComponent(started.json.runId));
	poll = polled.json.run;
	if (poll.status === 'running') {
		running = true;
		break;
	}
	if (poll.status === 'failed' || poll.status === 'stopped') break;
}
check('sandbox Nest app starts and reports running', running, JSON.stringify(poll).slice(0, 300));
check('sandbox app exposes routes', running && Array.isArray(poll.routes) && poll.routes.length > 0, JSON.stringify(poll === null ? null : poll.routes).slice(0, 200));

if (running) {
	const first = (poll.routes.find((route) => route.method === 'GET' && route.path.indexOf(':') < 0) || poll.routes[0]);
	const target = String(first.path).replace(/:[A-Za-z0-9_]+/g, '1');
	const response = await request('POST', '/nest-assistant/api/playground/request', { runId: started.json.runId, method: first.method, path: target });
	check('proxied request reaches the sandbox app', response.status === 200 && response.json.response.status === 200, JSON.stringify(response.json).slice(0, 240));
	check('proxied response body is JSON', String(response.json.response.body).indexOf('{') >= 0 || String(response.json.response.body).indexOf('[') >= 0);
}
const stopped = await request('POST', '/nest-assistant/api/playground/stop', {});
check('POST /playground/stop ok', stopped.status === 200 && stopped.json.ok === true);

// ---------------------------------------------------------------------------
// Playground modules / code versions (SPEC §6–§7)
// ---------------------------------------------------------------------------
console.log('');
console.log('-- playground modules / code versions --');

const modulesBefore = await request('GET', '/nest-assistant/api/playground/modules');
check('GET /playground/modules ok', modulesBefore.status === 200 && modulesBefore.json.ok === true, JSON.stringify(modulesBefore.json).slice(0, 200));
const moduleList = Array.isArray(modulesBefore.json.modules) ? modulesBefore.json.modules : [];
const originalActive = modulesBefore.json.active;
check('module list returns the seeded modules', moduleList.length >= 2, String(moduleList.length));
check(
	'module summaries carry the SPEC fields',
	moduleList.every(
		(entry) =>
			typeof entry.id === 'string' &&
			typeof entry.stageId === 'string' &&
			typeof entry.titleZh === 'string' &&
			typeof entry.defaultFile === 'string' &&
			Array.isArray(entry.snapshots)
	),
	JSON.stringify(moduleList.slice(0, 2)),
);
check(
	'modules are sorted by stage/item (sandbox first)',
	moduleList.length > 0 &&
		moduleList[0].id === 'sandbox' &&
		moduleList.every((entry, index) => index === 0 || moduleList[index - 1].stageIndex <= entry.stageIndex),
	moduleList.map((entry) => entry.id).join(','),
);
check(
	'active payload exposes module/version/dirty',
	originalActive !== null &&
		typeof originalActive.moduleId === 'string' &&
		originalActive.version !== null &&
		typeof originalActive.version.kind === 'string' &&
		typeof originalActive.dirty === 'boolean',
	JSON.stringify(originalActive),
);

// Prefer the Lead-authored s1-1 module so this suite never depends on a content
// agent's in-progress module.
const targetModule =
	moduleList.find((entry) => entry.id !== originalActive.moduleId && entry.id === 's1-1') ||
	moduleList.find((entry) => entry.id !== originalActive.moduleId);
const createdSnapshots = [];
check('a second module is available to switch to', targetModule !== undefined, moduleList.map((entry) => entry.id).join(','));

if (targetModule !== undefined) {
	try {
		// "切换前先停止运行": start a run, then switch modules and expect it stopped.
		let switchedWhileRunning = null;
		const startedBeforeSwitch = await request('POST', '/nest-assistant/api/playground/run', {});
		if (typeof startedBeforeSwitch.json.runId === 'string') {
			switchedWhileRunning = await request('POST', '/nest-assistant/api/playground/module', { moduleId: targetModule.id });
			const runAfterSwitch = await request('GET', '/nest-assistant/api/playground/poll?runId=' + encodeURIComponent(startedBeforeSwitch.json.runId));
			check(
				'POST /playground/module switches modules',
				switchedWhileRunning.status === 200 && switchedWhileRunning.json.ok === true && switchedWhileRunning.json.active.moduleId === targetModule.id,
				JSON.stringify(switchedWhileRunning.json).slice(0, 240),
			);
			check(
				'switching a module stops the previous run',
				runAfterSwitch.json !== null && runAfterSwitch.json.run !== undefined && runAfterSwitch.json.run.status === 'stopped',
				JSON.stringify(runAfterSwitch.json).slice(0, 240),
			);
		} else {
			check('POST /playground/module switches modules', false, JSON.stringify(startedBeforeSwitch.json).slice(0, 240));
			switchedWhileRunning = await request('POST', '/nest-assistant/api/playground/module', { moduleId: targetModule.id });
		}
		check(
			'switched module starts on its default version',
			switchedWhileRunning !== null &&
				switchedWhileRunning.json.active !== undefined &&
				switchedWhileRunning.json.active.version.kind === 'default' &&
				switchedWhileRunning.json.active.dirty === false,
			JSON.stringify(switchedWhileRunning === null ? null : switchedWhileRunning.json.active).slice(0, 200),
		);

		const filesAfterSwitch = await request('GET', '/nest-assistant/api/playground/files');
		check(
			'switched workspace exposes the module default files',
			filesAfterSwitch.status === 200 &&
				Array.isArray(filesAfterSwitch.json.files) &&
				filesAfterSwitch.json.files.some((file) => file.path === 'package.json') &&
				filesAfterSwitch.json.files.some((file) => file.path === 'src/app.module.ts'),
			JSON.stringify(filesAfterSwitch.json).slice(0, 200),
		);
		const defaultFileResponse = await request('GET', '/nest-assistant/api/playground/file?path=' + encodeURIComponent(targetModule.defaultFile));
		check(
			'module default file is readable',
			defaultFileResponse.status === 200 && typeof defaultFileResponse.json.content === 'string' && defaultFileResponse.json.content.length > 0,
			JSON.stringify(defaultFileResponse.json).slice(0, 160),
		);

		const tempFilePath = 'src/api-suite-temp.ts';
		const tempWrite = await request('PUT', '/nest-assistant/api/playground/file', { path: tempFilePath, content: '// host api suite temp\n' });
		check('PUT /playground/file works in the switched module', tempWrite.status === 200 && tempWrite.json.ok === true, JSON.stringify(tempWrite.json).slice(0, 160));
		const dirtyListing = await request('GET', '/nest-assistant/api/playground/modules');
		check('file writes mark the workspace dirty', dirtyListing.json.active.dirty === true, JSON.stringify(dirtyListing.json.active).slice(0, 200));
		const tempDelete = await request('DELETE', '/nest-assistant/api/playground/entry', { path: tempFilePath });
		check('DELETE /playground/entry removes the temp file', tempDelete.status === 200 && tempDelete.json.ok === true, JSON.stringify(tempDelete.json).slice(0, 160));

		const protectedRootDelete = await request('DELETE', '/nest-assistant/api/playground/entry', { path: 'package.json' });
		check('DELETE /playground/entry refuses root config files', protectedRootDelete.status === 500 && protectedRootDelete.json.ok === false, JSON.stringify(protectedRootDelete.json).slice(0, 200));
		const protectedSrcDelete = await request('DELETE', '/nest-assistant/api/playground/entry', { path: 'src' });
		check('DELETE /playground/entry refuses the src directory', protectedSrcDelete.status === 500 && protectedSrcDelete.json.ok === false, JSON.stringify(protectedSrcDelete.json).slice(0, 200));

		const snapshotName = 'host-api-suite-' + Date.now().toString(36);
		const savedSnapshot = await request('POST', '/nest-assistant/api/playground/snapshot', { name: snapshotName });
		const createdSnapshot = savedSnapshot.json.snapshot;
		check(
			'POST /playground/snapshot saves a version',
			savedSnapshot.status === 200 &&
				savedSnapshot.json.ok === true &&
				createdSnapshot !== undefined &&
				typeof createdSnapshot.id === 'string' &&
				createdSnapshot.name === snapshotName,
			JSON.stringify(savedSnapshot.json).slice(0, 240),
		);
		if (createdSnapshot !== undefined && typeof createdSnapshot.id === 'string') {
			createdSnapshots.push({ moduleId: targetModule.id, snapshotId: createdSnapshot.id });
			check(
				'snapshot metadata and files are persisted',
				fs.existsSync(path.join(savesDirPath, targetModule.id, createdSnapshot.id, 'meta.json')) &&
					fs.existsSync(path.join(savesDirPath, targetModule.id, createdSnapshot.id, 'files', 'src', 'app.module.ts')),
				createdSnapshot.id,
			);
			check(
				'snapshot capture skips build/ and runner.cjs',
				!fs.existsSync(path.join(savesDirPath, targetModule.id, createdSnapshot.id, 'files', 'build')) &&
					!fs.existsSync(path.join(savesDirPath, targetModule.id, createdSnapshot.id, 'files', 'runner.cjs')),
			);
			check(
				'snapshot becomes the active version',
				savedSnapshot.json.active.version.kind === 'snapshot' &&
					savedSnapshot.json.active.version.snapshotId === createdSnapshot.id &&
					savedSnapshot.json.active.dirty === false,
				JSON.stringify(savedSnapshot.json.active).slice(0, 200),
			);

			const duplicateSnapshot = await request('POST', '/nest-assistant/api/playground/snapshot', { name: snapshotName });
			check(
				'duplicate snapshot names are rejected',
				duplicateSnapshot.status === 500 && duplicateSnapshot.json.ok === false && String(duplicateSnapshot.json.error).indexOf('同名') >= 0,
				JSON.stringify(duplicateSnapshot.json).slice(0, 200),
			);

			const loadedSnapshot = await request('POST', '/nest-assistant/api/playground/version', { kind: 'snapshot', snapshotId: createdSnapshot.id });
			check(
				'POST /playground/version loads a snapshot',
				loadedSnapshot.status === 200 && loadedSnapshot.json.ok === true && loadedSnapshot.json.active.version.snapshotId === createdSnapshot.id,
				JSON.stringify(loadedSnapshot.json).slice(0, 240),
			);
			const loadedDefault = await request('POST', '/nest-assistant/api/playground/version', { kind: 'default' });
			check(
				'POST /playground/version loads the module default',
				loadedDefault.status === 200 && loadedDefault.json.ok === true && loadedDefault.json.active.version.kind === 'default',
				JSON.stringify(loadedDefault.json).slice(0, 240),
			);

			await request('POST', '/nest-assistant/api/playground/version', { kind: 'snapshot', snapshotId: createdSnapshot.id });
			const deleteActiveSnapshot = await request('DELETE', '/nest-assistant/api/playground/snapshot', { snapshotId: createdSnapshot.id });
			check(
				'DELETE /playground/snapshot refuses the active version',
				deleteActiveSnapshot.status === 500 && deleteActiveSnapshot.json.ok === false && String(deleteActiveSnapshot.json.error).indexOf('当前正在使用') >= 0,
				JSON.stringify(deleteActiveSnapshot.json).slice(0, 200),
			);
			await request('POST', '/nest-assistant/api/playground/version', { kind: 'default' });
			const deletedSnapshot = await request('DELETE', '/nest-assistant/api/playground/snapshot', { snapshotId: createdSnapshot.id });
			check(
				'DELETE /playground/snapshot removes an unused version',
				deletedSnapshot.status === 200 && deletedSnapshot.json.ok === true && !fs.existsSync(path.join(savesDirPath, targetModule.id, createdSnapshot.id)),
				JSON.stringify(deletedSnapshot.json).slice(0, 200),
			);
			const afterDeleteListing = await request('GET', '/nest-assistant/api/playground/modules');
			check(
				'deleted snapshot disappears from the module summary',
				afterDeleteListing.json.modules.some((entry) => entry.id === targetModule.id) &&
					afterDeleteListing.json.modules.find((entry) => entry.id === targetModule.id).snapshots.every((entry) => entry.id !== createdSnapshot.id),
			);
		}

		const extraPath = path.join(root, 'playground', 'src', 'api-suite-extra.ts');
		await request('PUT', '/nest-assistant/api/playground/file', { path: 'src/api-suite-extra.ts', content: '// extra\n' });
		const resetModule = await request('POST', '/nest-assistant/api/playground/reset', {});
		check(
			'POST /playground/reset restores the current module default',
			resetModule.status === 200 &&
				resetModule.json.ok === true &&
				resetModule.json.active.moduleId === targetModule.id &&
				resetModule.json.active.version.kind === 'default' &&
				resetModule.json.active.dirty === false,
			JSON.stringify(resetModule.json).slice(0, 240),
		);
		check('reset restores the module default files', !fs.existsSync(extraPath));

		const badModule = await request('POST', '/nest-assistant/api/playground/module', { moduleId: 'no-such-module' });
		check(
			'POST /playground/module rejects unknown modules',
			badModule.status === 500 && badModule.json.ok === false && String(badModule.json.error).indexOf('未知模块') >= 0,
			JSON.stringify(badModule.json).slice(0, 200),
		);
		const badVersion = await request('POST', '/nest-assistant/api/playground/version', { kind: 'snapshot', snapshotId: 's-missing-000' });
		check(
			'POST /playground/version rejects unknown snapshots',
			badVersion.status === 500 && badVersion.json.ok === false && String(badVersion.json.error).indexOf('代码版本不存在') >= 0,
			JSON.stringify(badVersion.json).slice(0, 200),
		);
	} finally {
		// Restore the original active module/version and remove test snapshots.
		try {
			await request('POST', '/nest-assistant/api/playground/module', { moduleId: originalActive.moduleId });
		} catch (_error) {
			/* recorded by the restore check below */
		}
		try {
			if (originalActive.version.kind === 'snapshot' && typeof originalActive.version.snapshotId === 'string') {
				await request('POST', '/nest-assistant/api/playground/version', { kind: 'snapshot', snapshotId: originalActive.version.snapshotId });
			} else {
				await request('POST', '/nest-assistant/api/playground/reset', {});
			}
		} catch (_error) {
			/* recorded by the restore check below */
		}
		for (const snapshot of createdSnapshots) {
			try {
				fs.rmSync(path.join(savesDirPath, snapshot.moduleId, snapshot.snapshotId), { recursive: true, force: true });
			} catch (_error) {
				/* best-effort */
			}
			try {
				const moduleSavesDir = path.join(savesDirPath, snapshot.moduleId);
				if (fs.readdirSync(moduleSavesDir).length === 0) fs.rmdirSync(moduleSavesDir);
			} catch (_error) {
				/* best-effort */
			}
		}
		if (!savesExistedOriginally) {
			try {
				if (fs.readdirSync(savesDirPath).length === 0) fs.rmdirSync(savesDirPath);
			} catch (_error) {
				/* best-effort */
			}
		}
		// Put the original playground-state.json back exactly as it was.
		try {
			if (originalStateRaw !== null) fs.writeFileSync(stateFilePath, originalStateRaw, 'utf8');
			else if (fs.existsSync(stateFilePath)) fs.rmSync(stateFilePath, { force: true });
		} catch (_error) {
			/* best-effort */
		}
		const restoredListing = await request('GET', '/nest-assistant/api/playground/modules');
		check(
			'restored the original active module',
			restoredListing.status === 200 &&
				restoredListing.json.active !== null &&
				restoredListing.json.active.moduleId === originalActive.moduleId &&
				restoredListing.json.active.version.kind === originalActive.version.kind,
			JSON.stringify(restoredListing.json.active).slice(0, 200),
		);
		check(
			'no test snapshot directories were left behind',
			createdSnapshots.every((snapshot) => !fs.existsSync(path.join(savesDirPath, snapshot.moduleId, snapshot.snapshotId))),
		);
	}
}

for (const entry of disposers) {
	if (typeof entry.dispose === 'function') {
		try {
			await entry.dispose();
		} catch (_error) {
			/* ignore */
		}
	}
}
console.log('');
console.log(String(checks - failures) + '/' + String(checks) + ' checks passed' + (failures === 0 ? '' : ', ' + String(failures) + ' FAILED'));
if (failures > 0) process.exitCode = 1;
