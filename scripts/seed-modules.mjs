// Seed `playground-modules/<itemId>/module.json` for every learning-route item
// (and the free-form `sandbox` module) from the generated learning route data.
//
// The default projects under each module's `default/` are authored separately;
// this script only writes metadata and never touches existing files unless
// `--force` is passed. Re-runs are therefore safe.
//
// Usage:
//   node scripts/seed-modules.mjs           # create missing module.json only
//   node scripts/seed-modules.mjs --force   # rewrite module.json (keeps summary/routes when present)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_DIR = path.join(ROOT, 'playground-modules');
const ROUTE_FILE = path.join(ROOT, 'knowledge', 'learning-route.json');
const TEMPLATE_DIR = path.join(ROOT, 'host', 'playground-template');

const force = process.argv.includes('--force');
const routeData = JSON.parse(fs.readFileSync(ROUTE_FILE, 'utf8'));

/** Recursively copy the starter template for the free-form sandbox module. */
function copyTemplate(source, target) {
	fs.mkdirSync(target, { recursive: true });
	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'runner.cjs') continue;
		const from = path.join(source, entry.name);
		const to = path.join(target, entry.name);
		if (entry.isDirectory()) copyTemplate(from, to);
		else fs.copyFileSync(from, to);
	}
}

function writeManifest(moduleId, manifest) {
	const dir = path.join(MODULES_DIR, moduleId);
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, 'module.json');
	let previous = null;
	try {
		previous = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (_error) {
		previous = null;
	}
	if (previous !== null && !force) return { created: false, file };
	const merged = Object.assign({}, manifest);
	if (previous !== null && !force) {
		// unreachable; retained for clarity
	}
	if (previous !== null && force) {
		// Keep authored content when re-seeding metadata.
		for (const key of ['summary', 'routes', 'defaultFile']) {
			if (previous[key] !== undefined) merged[key] = previous[key];
		}
	}
	fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n', 'utf8');
	return { created: true, file };
}

let created = 0;
let skipped = 0;

// The free-form sandbox module keeps the original cats example available.
const sandboxDir = path.join(MODULES_DIR, 'sandbox');
const sandboxManifest = {
	id: 'sandbox',
	itemId: null,
	stageId: 'sandbox',
	stageIndex: 0,
	itemIndex: 0,
	stageTitleZh: '自由沙盒',
	titleZh: '自由沙盒（原始示例）',
	title: 'Free sandbox (starter example)',
	level: 'L1',
	goal: '不绑定任何练习的自由沙盒：保留最初的内存版 Cats 示例，随便改。',
	practice: '自由修改、新增模块与路由，保存成你自己的代码版本。',
	deliverable: '任意可运行的服务',
	accept: '能启动并通过请求台调用',
	minutes: 0,
	pageIds: ['first-steps'],
	summary: '初始示例工程：内存数组版 Cats 资源，含 AppModule、CatsModule、controller 与 service。',
	defaultFile: 'src/app.module.ts',
	routes: [
		{ method: 'GET', path: '/health', expect: 200 },
		{ method: 'GET', path: '/cats', expect: 200 }
	]
};
const sandboxWrite = writeManifest('sandbox', sandboxManifest);
if (sandboxWrite.created) created += 1;
else skipped += 1;
if (!fs.existsSync(path.join(sandboxDir, 'default'))) {
	copyTemplate(TEMPLATE_DIR, path.join(sandboxDir, 'default'));
}

for (const [stageIndex, stage] of routeData.stages.entries()) {
	for (const [itemIndex, item] of stage.items.entries()) {
		const manifest = {
			id: item.id,
			itemId: item.id,
			stageId: stage.id,
			stageIndex: stageIndex + 1,
			itemIndex: itemIndex + 1,
			stageTitleZh: stage.titleZh,
			titleZh: item.title,
			title: item.title,
			level: item.level,
			goal: item.goal,
			practice: item.practice,
			deliverable: item.deliverable,
			accept: item.accept,
			minutes: item.minutes,
			pageIds: item.pageIds,
			summary: '',
			defaultFile: 'src/app.module.ts',
			routes: []
		};
		const result = writeManifest(item.id, manifest);
		if (result.created) created += 1;
		else skipped += 1;
	}
}

console.log('modules seeded: ' + String(created) + ' written, ' + String(skipped) + ' kept');
console.log('next: author playground-modules/<id>/default/** and run node scripts/verify-modules.mjs');
