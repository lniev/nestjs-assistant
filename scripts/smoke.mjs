// Offline smoke test for the NestJS Assistant plugin.
//
// It does not need a browser. It verifies:
//  1. the knowledge index / parts / generated data integrity;
//  2. the enterprise map and learning route structure and page references;
//  3. the generated Client bundle loads through the module loader contract,
//     registers its slots, and every panel view renders without throwing;
//  4. the Host entry parses and the manifest carries the expected bundle fields.
//
// Usage: node scripts/smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
let failures = 0;

function check(name, condition, detail) {
	checks += 1;
	if (condition) {
		console.log('  ok   ' + name);
	} else {
		failures += 1;
		console.log('  FAIL ' + name + (detail === undefined ? '' : ' -> ' + detail));
	}
}

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---- 1. knowledge integrity -------------------------------------------------
console.log('knowledge');
const index = readJson(path.join(root, 'knowledge', '_index.json'));
const knownIds = new Set(index.pages.map((page) => page.id));
check('index has 165 official pages', index.pages.length === 165, String(index.pages.length));
check('index has chapters with items', Array.isArray(index.chapters) && index.chapters.length >= 20);
const partsDir = path.join(root, 'knowledge', 'parts');
const partPages = new Map();
const duplicateIds = [];
let partFiles = 0;
if (fs.existsSync(partsDir)) {
	for (const file of fs.readdirSync(partsDir).sort()) {
		if (!file.endsWith('.json')) continue;
		partFiles += 1;
		const data = readJson(path.join(partsDir, file));
		if (!Array.isArray(data)) {
			check(file + ' is an array', false);
			continue;
		}
		for (const page of data) {
			if (partPages.has(page.id)) duplicateIds.push(page.id);
			partPages.set(page.id, page);
		}
	}
}
check('part files exist', partFiles > 0, String(partFiles));
check('no duplicate page ids across parts', duplicateIds.length === 0, duplicateIds.slice(0, 5).join(','));
for (const id of ['introduction', 'controllers', 'fundamentals/dynamic-modules', 'graphql/quick-start', 'microservices/basics', 'openapi/introduction', 'recipes/cqrs', 'faq/common-errors']) {
	check('sample page summarized: ' + id, partPages.has(id));
}
const missing = index.pages.filter((page) => !partPages.has(page.id));
check('all official pages summarized (' + missing.length + ' missing)', missing.length === 0, missing.slice(0, 8).map((page) => page.id).join(','));
const schemaIssues = [];
const qualityIssues = [];
const PLACEHOLDER = /（该页内容尚未生成）|TODO|待补充|尚未生成|请在此填写|Lorem ipsum/;
for (const [id, page] of partPages) {
	const report = (title) => schemaIssues.push(id + ': ' + title);
	if (!knownIds.has(id)) report('unknown id');
	if (typeof page.titleZh !== 'string' || page.titleZh.trim() === '') report('titleZh');
	if (typeof page.summary !== 'string' || page.summary.trim().length < 40) report('summary');
	if (!Array.isArray(page.keyPoints) || page.keyPoints.length === 0) report('keyPoints');
	if (!Array.isArray(page.sections)) report('sections');
	if (!Array.isArray(page.snippets)) report('snippets');
	if (!Array.isArray(page.api)) report('api');
	if (!Array.isArray(page.pitfalls)) report('pitfalls');
	if (typeof page.enterprise !== 'string') report('enterprise');
	if (!Array.isArray(page.related)) report('related');
	else for (const ref of page.related) if (typeof ref !== 'string' || !knownIds.has(ref) || ref === id) qualityIssues.push(id + ': related -> ' + String(ref));
	const blob = JSON.stringify(page);
	if (PLACEHOLDER.test(blob)) qualityIssues.push(id + ': placeholder text');
	if (page.summary.length > 400) qualityIssues.push(id + ': summary too long');
	if (Array.isArray(page.sections) && page.sections.length < 2) qualityIssues.push(id + ': < 2 sections');
	if (Array.isArray(page.keyPoints) && page.keyPoints.length < 4) qualityIssues.push(id + ': < 4 keyPoints');
	if (page.enterprise.trim().length < 20) qualityIssues.push(id + ': weak enterprise advice');
}
check('page objects satisfy the schema', schemaIssues.length === 0, schemaIssues.slice(0, 8).join(' | '));
check('page content passes the quality scan', qualityIssues.length === 0, qualityIssues.slice(0, 8).join(' | '));

// ---- 2. enterprise map + learning route ------------------------------------
console.log('generated content');
const mapPath = path.join(root, 'knowledge', 'enterprise-map.json');
const routePath = path.join(root, 'knowledge', 'learning-route.json');
const map = fs.existsSync(mapPath) ? readJson(mapPath) : null;
const route = fs.existsSync(routePath) ? readJson(routePath) : null;
check('enterprise map exists', map !== null);
check('learning route exists', route !== null);
if (map !== null) {
	const layerIds = new Set((map.layers || []).map((layer) => layer.id));
	check('enterprise map has >= 10 domains', Array.isArray(map.domains) && map.domains.length >= 10, String((map.domains || []).length));
	check('enterprise map has layers', layerIds.size > 0);
	let badLayer = null;
	const badRefs = [];
	for (const domain of map.domains || []) {
		if (!layerIds.has(domain.layerId)) badLayer = domain.id;
		for (const practice of domain.practices || []) {
			for (const ref of practice.pageRefs || []) if (!knownIds.has(ref)) badRefs.push(ref);
		}
	}
	check('domain layerIds resolve', badLayer === null, String(badLayer));
	check('domain pageRefs resolve', badRefs.length === 0, badRefs.slice(0, 5).join(','));
}
if (route !== null) {
	const stageIds = new Set((route.stages || []).map((stage) => stage.id));
	check('learning route has 5-8 stages', Array.isArray(route.stages) && route.stages.length >= 5 && route.stages.length <= 8, String((route.stages || []).length));
	let items = 0;
	const badRefs = [];
	let incomplete = null;
	for (const stage of route.stages || []) {
		for (const item of stage.items || []) {
			items += 1;
			for (const ref of item.pageIds || []) if (!knownIds.has(ref)) badRefs.push(ref);
			if (typeof item.accept !== 'string' || typeof item.deliverable !== 'string' || typeof item.minutes !== 'number') incomplete = item.id;
		}
	}
	check('learning route has 20+ items', items >= 20, String(items));
	check('route pageIds resolve', badRefs.length === 0, badRefs.slice(0, 5).join(','));
	check('route items carry deliverable/accept/minutes', incomplete === null, String(incomplete));
	for (const track of route.tracks || []) {
		const ok = (track.stageIds || []).every((id) => stageIds.has(id));
		check('track stage ids resolve: ' + track.id, ok);
	}
}

// ---- 3. generated data (if built) ------------------------------------------
const dataPath = path.join(root, 'knowledge', 'data.json');
if (fs.existsSync(dataPath)) {
	const data = readJson(dataPath);
	check('data.json chapters match index', Array.isArray(data.chapters) && data.chapters.length === index.chapters.length);
	check('data.json page count matches index', Object.keys(data.pages).length === index.pages.length);
	check('data.json includes every summarized page', missing.length === 0 && Object.values(data.pages).every((page) => page.summary !== '（该页内容尚未生成）'));
} else {
	console.log('  note knowledge/data.json not built yet (run scripts/build-data.mjs)');
}

// ---- 4. Client bundle contract + render -----------------------------------
console.log('client half');
const bundleIndex = process.argv.indexOf('--bundle');
const bundlePath = bundleIndex >= 0 && typeof process.argv[bundleIndex + 1] === 'string' && process.argv[bundleIndex + 1] !== ''
	? path.resolve(process.cwd(), process.argv[bundleIndex + 1])
	: path.join(root, 'client.js');
const clientSource = fs.readFileSync(bundlePath, 'utf8');
let loaded = null;
const ReactStub = {
	createElement(type, props) {
		const children = Array.prototype.slice.call(arguments, 2);
		return { type, props: props === null || props === undefined ? {} : props, children };
	},
	useState(initial) {
		const value = typeof initial === 'function' ? initial() : initial;
		return [value, function () {}];
	},
	useEffect() {},
	useMemo(factory) {
		return factory();
	},
	useRef(value) {
		return { current: value };
	},
	useCallback(fn) {
		return fn;
	}
};
const windowStub = {
	localStorage: {
		store: {},
		getItem(key) { return this.store[key] === undefined ? null : this.store[key]; },
		setItem(key, value) { this.store[key] = String(value); },
		removeItem(key) { delete this.store[key]; }
	},
	setTimeout,
	clearTimeout,
	confirm: () => true,
	prompt: () => null
};
const context = {
	window: windowStub,
	React: ReactStub,
	h: ReactStub.createElement,
	document: null,
	navigator: undefined,
	crypto: undefined,
	Intl,
	Date,
	Math,
	JSON,
	setTimeout,
	clearTimeout,
	requestAnimationFrame: (fn) => fn(),
	console
};
context.window.__ModuleLoader__ = {
	load(entry) { loaded = entry; }
};
// Test-only instrumentation: expose the view components from the factory scope
// so the smoke test can render each view directly with representative data.
const instrumentedSource = clientSource.replace(
	'return { inject, apply };',
	'return { inject, apply, __test: { NestAssistantPanel, NestKnowledgeView, NestEnterpriseMapView, NestLearningRouteView, NestPlaygroundView, NestKbPage, NestMapDetail, NestKbSnippet, NestRouteStage, NestPgEditor, NestPgResult, NestPgFileTree, NestPgCreateBar, NestPgModuleBar, nestPgBuildTree, nestPgFlattenTree, nestPgPreferredFile, nestPgDeletable, nestPgValidateEntry, nestPgModuleGroups, nestRenderRichText, nestFoldEntries, nestAppendEntry } };'
);
vm.createContext(context);
vm.runInContext(instrumentedSource, context, { filename: 'client.js' });
check('bundle calls __ModuleLoader__.load', loaded !== null);
check('bundle id is @local/nest-assistant', loaded !== null && loaded.id === '@local/nest-assistant', loaded === null ? '' : String(loaded.id));
let factoryResult = null;
if (loaded !== null) {
	factoryResult = loaded.factory((name) => {
		if (name === 'react') return ReactStub;
		throw new Error('unexpected require: ' + name);
	});
}
check('factory returns inject/apply', factoryResult !== null && Array.isArray(factoryResult.inject) && typeof factoryResult.apply === 'function');

/** Recursively render the element tree with function components. */
function renderTree(node, depth) {
	if (node === null || node === undefined || depth > 40) return;
	if (Array.isArray(node)) {
		for (const child of node) renderTree(child, depth + 1);
		return;
	}
	if (typeof node === 'string' || typeof node === 'number') return;
	if (typeof node !== 'object') return;
	if (typeof node.type === 'function') {
		const rendered = node.type(Object.assign({}, node.props, { children: node.children }));
		renderTree(rendered, depth + 1);
		return;
	}
	if (node.children !== undefined) renderTree(node.children, depth + 1);
	if (node.props !== undefined && node.props.children !== undefined) renderTree(node.props.children, depth + 1);
}

if (factoryResult !== null) {
	const slots = [];
	const dicts = [];
	const fakeT = (key, params) => {
		if (typeof key !== 'string') return '';
		return params === undefined ? key : key + JSON.stringify(params);
	};
	const ctx = {
		effect(callback) {
			const dispose = callback();
			if (typeof dispose === 'function') dispose();
			return function () {};
		},
		locale: {
			register(namespace, dict) { dicts.push({ namespace, dict }); return function () {}; },
			bind() { return fakeT; }
		},
		slots: {
			inject(owner, callback) { callback(); return function () {}; },
			register(options, component) { slots.push({ options, component }); return function () {}; }
		},
		get() {
			return undefined;
		}
	};
	let applyError = null;
	try {
		factoryResult.apply(ctx);
	} catch (error) {
		applyError = error;
	}
	check('apply() runs without throwing', applyError === null, applyError === null ? '' : applyError.stack);
	check('registers two slots', slots.length === 2, String(slots.length));
	const exposed = factoryResult.__test === undefined ? {} : factoryResult.__test;
	const main = slots.find((slot) => slot.options.name === 'main');
	const sidebar = slots.find((slot) => slot.options.name === 'sidebar.panellist');
	check('registers main panel key nest-assistant', main !== undefined && main.options.key === 'nest-assistant');
	check('registers sidebar.panellist icon with same id', sidebar !== undefined && sidebar.options.id === 'nest-assistant');
	check('dictionary merge keeps title', dicts.length > 0 && dicts[0].dict.zh.title === 'NestJS 助手');
	check('dictionary merge keeps kb intro', dicts.length > 0 && typeof dicts[0].dict.zh['kb.intro'] === 'string');

	// Render the panel with a small representative knowledge object.
	const kb = {
		meta: { counts: { pages: 2 } },
		chapters: [{ id: 'overview', title: 'Overview', titleZh: '概览', introZh: '概览', items: [{ id: 'first-steps', title: 'First steps', titleZh: '第一步' }] }],
		pages: {
			'first-steps': {
				id: 'first-steps', title: 'First steps', titleZh: '第一步', chapter: 'overview', chapterTitle: 'Overview', chapterTitleZh: '概览',
				summary: '这是示例总结。', sections: [{ heading: '核心', text: '说明。' }], keyPoints: ['要点一'], snippets: [{ title: '示例', lang: 'typescript', code: 'const a = 1;' }],
				api: ['@Controller()'], pitfalls: ['注意一'], enterprise: '企业建议。', related: [], officialUrl: 'https://docs.nestjs.com/first-steps'
			}
		},
		enterpriseMap: null,
		learningRoute: null
	};
	const workspacesState = { items: [{ workspaceId: 'w1', title: 'Ass', sessionIds: [] }] };
	const sessionsState = { byId: {} };
	const panelProps = {
		t: fakeT,
		useSessions: (selector) => selector(sessionsState),
		useWorkspaces: (selector) => selector(workspacesState)
	};
	let renderError = null;
	try {
		const panelElement = main.component(panelProps);
		renderTree(panelElement, 0);
	} catch (error) {
		renderError = error;
	}
	check('panel renders without throwing', renderError === null, renderError === null ? '' : renderError.stack);

	// Render every tab with representative data (the tab is restored from
	// localStorage, so seeding the stub store exercises each view).
	const mapData = {
		titleZh: '企业级 NestJS 开发知识地图',
		intro: '示例地图。',
		layers: [{ id: 'foundation', titleZh: '工程基础层', description: '示例层说明。' }],
		maturity: [{ level: 'L1', titleZh: '能跑', description: '示例。' }, { level: 'L2', titleZh: '可维护', description: '示例。' }, { level: 'L3', titleZh: '可观测', description: '示例。' }, { level: 'L4', titleZh: '平台化', description: '示例。' }],
		domains: [{
			id: 'architecture', titleZh: '架构与模块化', title: 'Architecture', layerId: 'foundation', essential: '示例原因。',
			practices: [{ title: '模块边界', detail: '示例实践。', level: 'L2', pageRefs: ['fundamentals/dynamic-modules'] }],
			checklist: ['检查项一'], antiPatterns: ['反模式一'], nestApi: ['@Module']
		}],
		projectTemplate: { summary: '示例结构。', tree: ['src/', '  main.ts'] }
	};
	const routeData = {
		titleZh: 'NestJS 学习路线', intro: '示例路线。', totalHours: 120,
		tracks: [{ id: 'main', titleZh: '主路线', description: '示例。', stageIds: ['s1'] }],
		stages: [{
			id: 's1', title: 'Stage 1', titleZh: '心智模型', weeks: '第 1 周', goal: '示例目标。', hours: 10,
			items: [{
				id: 's1-1', title: '读懂启动链路', goal: '示例目标。', points: ['要点一'], deliverable: '一个可运行的接口',
				accept: '能启动并访问接口', minutes: 90, level: 'L1', pageIds: ['first-steps'], practice: '在操练场实现 GET /cats'
			}]
		}],
		checkpoints: [{ title: '阶段验收一', description: '示例验收。' }]
	};
	const kbFull = Object.assign({}, kb, { enterpriseMap: mapData, learningRoute: routeData });
	for (const tab of ['map', 'route', 'playground', 'knowledge']) {
		windowStub.localStorage.store['nest-assistant:tab'] = JSON.stringify(tab);
		let tabError = null;
		try {
			const props = Object.assign({}, panelProps);
			const element = main.component(props);
			renderTree(element, 0);
		} catch (error) {
			tabError = error;
		}
		check('panel renders tab: ' + tab, tabError === null, tabError === null ? '' : tabError.stack);
	}

	// Direct view renders with representative data (real props, no panel fetch).
	const page = kb.pages['first-steps'];
	const direct = [];
	direct.push(['knowledge view', exposed.NestKnowledgeView, { t: fakeT, kb, initialPageId: 'first-steps', onAskAi() {}, onOpenPage() {} }]);
	direct.push(['knowledge page content', exposed.NestKbPage, { t: fakeT, page, chapter: kb.chapters[0], onAskAi() {}, onOpenPage() {}, copiedKey: null, setCopiedKey() {} }]);
	direct.push(['knowledge snippet', exposed.NestKbSnippet, { t: fakeT, snippet: page.snippets[0], copied: false, onCopy() {} }]);
	direct.push(['enterprise map view', exposed.NestEnterpriseMapView, { t: fakeT, map: mapData, onAskAi() {}, onOpenPage() {} }]);
	direct.push(['enterprise map detail', exposed.NestMapDetail, { t: fakeT, domain: mapData.domains[0], onClose() {}, onAskAi() {}, onOpenPage() {} }]);
	direct.push(['learning route view', exposed.NestLearningRouteView, { t: fakeT, route: routeData, progress: { 's1-1': true }, onToggleItem() {}, onAskAi() {}, onOpenPage() {} }]);
	direct.push(['learning route stage', exposed.NestRouteStage, { t: fakeT, stage: routeData.stages[0], index: 0, progress: { 's1-1': true }, collapsed: false, onToggleCollapse() {}, onToggleItem() {}, onAskAi() {}, onOpenPage() {} }]);
	direct.push(['playground view', exposed.NestPlaygroundView, { t: fakeT, workspaceId: 'w1', workspaceState: workspacesState, queuedPrompt: null, onPromptSent() {}, onAskAi() {} }]);
	direct.push(['playground view with route hand-off', exposed.NestPlaygroundView, { t: fakeT, workspaceId: 'w1', workspaceState: workspacesState, queuedPrompt: null, onPromptSent() {}, onAskAi() {}, initialModuleId: 's1-2', onInitialModuleConsumed() {} }]);
	direct.push(['playground editor', exposed.NestPgEditor, { value: 'import { Module } from \'@nestjs/common\';\n@Module({})\nexport class AppModule {}\n', onChange() {}, label: 'editor' }]);
	direct.push(['playground result', exposed.NestPgResult, { t: fakeT, result: { method: 'GET', path: '/cats', status: 200, body: '[]', timeMs: 12 } }]);
	const pgFiles = [{ path: 'package.json', size: 120, mtime: 1 }, { path: 'src/app.module.ts', size: 300, mtime: 2 }, { path: 'src/cats/cats.controller.ts', size: 400, mtime: 3 }];
	const pgDirs = [{ path: 'src' }, { path: 'src/cats' }, { path: 'src/cats/dto' }];
	const pgModules = [
		{ id: 'sandbox', itemIndex: 0, stageIndex: 0, stageId: 'sandbox', stageTitleZh: '自由沙盒', titleZh: '自由沙盒', summary: '原始 Cats 示例，随便改。', defaultFile: 'src/app.module.ts', snapshots: [] },
		{ id: 's1-1', itemId: 's1-1', stageId: 's1', stageIndex: 1, itemIndex: 1, stageTitleZh: '心智模型与最小可运行', titleZh: '读懂启动链路', summary: '示例模块一。', defaultFile: 'src/app.module.ts', snapshots: [{ id: 's-a1', name: '第一版', createdAt: 1, updatedAt: 1, fileCount: 5 }] },
		{ id: 's1-2', itemId: 's1-2', stageId: 's1', stageIndex: 1, itemIndex: 2, stageTitleZh: '心智模型与最小可运行', titleZh: '控制器与 REST 路由', summary: '示例模块二。', defaultFile: 'src/app.module.ts', snapshots: [{ id: 's-b2', name: '我的实现', createdAt: 2, updatedAt: 2, fileCount: 6 }] },
		{ id: 's2-1', itemId: 's2-1', stageId: 's2', stageIndex: 2, itemIndex: 1, stageTitleZh: '请求生命周期', titleZh: '管道与校验', summary: '示例模块三。', defaultFile: 'src/app.module.ts', snapshots: [] }
	];
	const pgActive = { moduleId: 's1-2', moduleTitleZh: '控制器与 REST 路由', stageId: 's1', stageTitleZh: '心智模型与最小可运行', defaultFile: 'src/app.module.ts', version: { kind: 'snapshot', snapshotId: 's-b2', name: '我的实现' }, dirty: true };
	const moduleBarProps = {
		t: fakeT,
		state: { phase: 'ready', modules: pgModules, active: pgActive },
		busy: false,
		fromRoute: true,
		onSwitchModule() {},
		onLoadVersion() {},
		onSaveSnapshot() {},
		onResetDefault() {},
		onDeleteSnapshot() {}
	};
	/** Walk a rendered React element tree and visit every element node. */
	function walkElements(node, visit, depth) {
		if (node === null || node === undefined || depth > 60) return;
		if (Array.isArray(node)) {
			for (const child of node) walkElements(child, visit, depth + 1);
			return;
		}
		if (typeof node !== 'object') return;
		visit(node);
		if (node.children !== undefined) walkElements(node.children, visit, depth + 1);
		if (node.props !== undefined && node.props.children !== undefined) walkElements(node.props.children, visit, depth + 1);
	}
	/** Flatten every text descendant of one rendered element. */
	function flattenText(node) {
		const parts = [];
		const visit = (value) => {
			if (value === null || value === undefined) return;
			if (typeof value === 'string' || typeof value === 'number') {
				parts.push(String(value));
				return;
			}
			if (Array.isArray(value)) {
				for (const child of value) visit(child);
				return;
			}
			if (typeof value === 'object') {
				if (value.children !== undefined) visit(value.children);
				if (value.props !== undefined && value.props.children !== undefined) visit(value.props.children);
			}
		};
		visit(node);
		return parts.join('');
	}
	direct.push(['playground module bar', exposed.NestPgModuleBar, moduleBarProps]);
	direct.push(['playground create bar', exposed.NestPgCreateBar, { t: fakeT, kind: 'dir', value: 'src/cats/dto/', onChange() {}, onSubmit() {}, onCancel() {} }]);
	direct.push(['playground file tree', exposed.NestPgFileTree, {
		t: fakeT,
		files: pgFiles,
		dirs: pgDirs,
		collapsed: { 'src/cats': true },
		selection: { kind: 'dir', path: 'src' },
		activePath: 'src/app.module.ts',
		onToggleDir() {},
		onSelectFile() {}
	}]);
	for (const [label, component, props] of direct) {
		if (typeof component !== 'function') {
			check('view exposed: ' + label, false);
			continue;
		}
		let caught = null;
		try {
			renderTree(component(props), 0);
		} catch (error) {
			caught = error;
		}
		check(label + ' renders', caught === null, caught === null ? '' : caught.stack);
	}

	// Playground module bar: stage grouping, module/version option text, dirty
	// state and the empty/loading states.
	if (typeof exposed.NestPgModuleBar === 'function') {
		const barElement = exposed.NestPgModuleBar(moduleBarProps);
		const options = [];
		const optgroups = [];
		const selects = [];
		const dirtyFlags = [];
		walkElements(barElement, (node) => {
			if (typeof node !== 'object' || node === null) return;
			if (node.type === 'option') options.push({ value: node.props.value, text: flattenText(node) });
			if (node.type === 'optgroup') optgroups.push(node.props.label);
			if (node.type === 'select') selects.push({ value: node.props.value });
			if (node.props !== undefined && node.props['data-dirty'] !== undefined) dirtyFlags.push(node.props['data-dirty']);
		});
		const optionTexts = options.map((option) => option.text);
		const barText = flattenText(barElement);
		check('playground module bar groups modules by stage', optgroups.length === 3, optgroups.join('|'));
		check('playground module bar option text is "<index>. <title>"', optionTexts.indexOf('2. 控制器与 REST 路由') >= 0, optionTexts.join('|'));
		check('playground module bar labels the sandbox specially', optionTexts.indexOf('pg.sandboxModule') >= 0, optionTexts.join('|'));
		check('playground module bar lists default code + snapshots', optionTexts.indexOf('pg.versionDefault') >= 0 && optionTexts.indexOf('我的实现') >= 0, optionTexts.join('|'));
		check('playground module bar selects the active snapshot', selects.some((select) => select.value === 's-b2'), JSON.stringify(selects));
		check('playground module bar shows the dirty indicator', dirtyFlags.indexOf('true') >= 0 && barText.indexOf('pg.unsaved') >= 0, barText);
		check('playground module bar shows the module summary', barText.indexOf('示例模块二。') >= 0, barText);
		check('playground module bar marks the learning-route origin', barText.indexOf('pg.fromRoute') >= 0, barText);
		const emptyBarProps = Object.assign({}, moduleBarProps, { state: { phase: 'ready', modules: [], active: null }, fromRoute: false });
		let emptyBarError = null;
		try {
			renderTree(exposed.NestPgModuleBar(emptyBarProps), 0);
		} catch (error) {
			emptyBarError = error;
		}
		check('playground module bar empty state renders', emptyBarError === null, emptyBarError === null ? '' : emptyBarError.stack);
		check('playground module bar empty state explains itself', flattenText(exposed.NestPgModuleBar(emptyBarProps)).indexOf('pg.noModules') >= 0);
		const loadingBarProps = Object.assign({}, moduleBarProps, { state: { phase: 'loading', modules: [], active: null } });
		let loadingBarError = null;
		try {
			renderTree(exposed.NestPgModuleBar(loadingBarProps), 0);
		} catch (error) {
			loadingBarError = error;
		}
		check('playground module bar loading state renders', loadingBarError === null && flattenText(exposed.NestPgModuleBar(loadingBarProps)).indexOf('pg.moduleLoading') >= 0, loadingBarError === null ? '' : loadingBarError.stack);
		const staleVersionProps = Object.assign({}, moduleBarProps, {
			state: { phase: 'ready', modules: pgModules, active: Object.assign({}, pgActive, { version: { kind: 'snapshot', snapshotId: 's-gone', name: '已删除的版本' } }) }
		});
		const staleText = flattenText(exposed.NestPgModuleBar(staleVersionProps));
		check('playground module bar keeps the active snapshot visible', staleText.indexOf('已删除的版本') >= 0, staleText);
		const defaultVersionProps = Object.assign({}, moduleBarProps, {
			state: { phase: 'ready', modules: pgModules, active: Object.assign({}, pgActive, { version: { kind: 'default' }, dirty: false }) }
		});
		const deleteButtonStates = [];
		walkElements(exposed.NestPgModuleBar(defaultVersionProps), (node) => {
			if (node !== null && typeof node === 'object' && node.props !== undefined && node.props.title === 'pg.deleteSnapshot') deleteButtonStates.push(node.props.disabled === true);
		});
		check('playground module bar disables delete on the default version', deleteButtonStates.length > 0 && deleteButtonStates.every(Boolean), JSON.stringify(deleteButtonStates));
	} else {
		check('playground module bar exposed', false);
	}

	// File-tree review fixes: deletion protection, preferred-file fallback and
	// create-form path validation.
	if (typeof exposed.nestPgDeletable === 'function') {
		check('playground protects root configs from deletion', exposed.nestPgDeletable({ kind: 'file', path: 'package.json' }) === false && exposed.nestPgDeletable({ kind: 'file', path: 'tsconfig.json' }) === false);
		check('playground protects the src directory itself', exposed.nestPgDeletable({ kind: 'dir', path: 'src' }) === false);
		check('playground allows deleting entries under src', exposed.nestPgDeletable({ kind: 'file', path: 'src/app.module.ts' }) === true && exposed.nestPgDeletable({ kind: 'dir', path: 'src/cats' }) === true);
	} else {
		check('playground delete guard exposed', false);
	}
	if (typeof exposed.nestPgPreferredFile === 'function') {
		const byDefault = exposed.nestPgPreferredFile([{ path: 'package.json' }, { path: 'src/main.ts' }, { path: 'src/app.module.ts' }], 'src/app.module.ts');
		check('playground preferred file follows defaultFile', byDefault !== null && byDefault.path === 'src/app.module.ts', byDefault === null ? 'null' : byDefault.path);
		const firstTs = exposed.nestPgPreferredFile([{ path: 'package.json' }, { path: 'src/main.ts' }], null);
		check('playground preferred file falls back to the first .ts file', firstTs !== null && firstTs.path === 'src/main.ts', firstTs === null ? 'null' : firstTs.path);
	} else {
		check('playground preferred-file helper exposed', false);
	}
	if (typeof exposed.nestPgValidateEntry === 'function') {
		check('playground create form refuses to submit the parent folder', exposed.nestPgValidateEntry('src/cats/', 'dir', 'src/cats').error === 'pg.nameRequired', JSON.stringify(exposed.nestPgValidateEntry('src/cats/', 'dir', 'src/cats')));
		check('playground create form rejects absolute paths', exposed.nestPgValidateEntry('/src/x.ts', 'file', 'src').error === 'pg.absolutePath', JSON.stringify(exposed.nestPgValidateEntry('/src/x.ts', 'file', 'src')));
		check('playground create form rejects a trailing slash on files', exposed.nestPgValidateEntry('src/x.ts/', 'file', 'src').error === 'pg.invalidName', JSON.stringify(exposed.nestPgValidateEntry('src/x.ts/', 'file', 'src')));
		check('playground create form trims input', exposed.nestPgValidateEntry('  src/x.ts  ', 'file', 'src').value === 'src/x.ts', JSON.stringify(exposed.nestPgValidateEntry('  src/x.ts  ', 'file', 'src')));
	} else {
		check('playground create validation exposed', false);
	}


	if (typeof exposed.nestPgBuildTree === 'function' && typeof exposed.nestPgFlattenTree === 'function') {
		const built = exposed.nestPgBuildTree(
			[{ path: 'package.json' }, { path: 'src/app.module.ts' }, { path: 'src/cats/cats.service.ts' }],
			[{ path: 'src' }, { path: 'src/cats' }, { path: 'src/empty-dir' }, { path: 'build' }]
		);
		const topLevel = built.children.map((node) => node.name + ':' + node.kind);
		const kinds = built.children.map((node) => node.kind);
		const firstFile = kinds.indexOf('file');
		check('playground tree puts folders before files', firstFile > 0 && kinds.slice(firstFile).every((kind) => kind === 'file'), topLevel.join(','));
		const srcNode = built.children.find((node) => node.path === 'src');
		check('playground tree keeps empty directories', srcNode !== undefined && srcNode.children.some((node) => node.path === 'src/empty-dir'));
		const flatRows = exposed.nestPgFlattenTree(built, 0, {}, []);
		const nested = flatRows.find((row) => row.node.path === 'src/cats/cats.service.ts');
		check('playground tree indents nested files', nested !== undefined && nested.depth === 2, nested === undefined ? '' : String(nested.depth));
		const hiddenRows = exposed.nestPgFlattenTree(built, 0, { 'src': true }, []);
		check('playground tree hides children of collapsed folders', !hiddenRows.some((row) => row.node.path === 'src/app.module.ts') && hiddenRows.some((row) => row.node.path === 'src'));
	} else {
		check('playground tree helpers exposed', false);
	}

	// Markdown renderer: One Dark fenced code, GFM tables and horizontal rules.
	if (typeof exposed.nestRenderRichText === 'function') {
		const md = [
			'## 标题', '',
			'- 条目 **粗体** 与 `inline`', '',
			'---', '',
			'```ts',
			"@Controller('cats')",
			'export class CatsController {',
			'  // 注释',
			'  @Get() findAll(@Query(\'limit\') limit = 10) { return limit; }',
			'}',
			'```', '',
			'| 请求 | 期望 |',
			'| --- | --- |',
			'| GET /health | 200 |',
			'| GET /api/version | 200 |'
		].join('\n');
		const mdNodes = exposed.nestRenderRichText(md);
		const collect = (nodes, predicate, found) => {
			for (const node of nodes) {
				if (node === null || node === undefined) continue;
				if (Array.isArray(node)) {
					collect(node, predicate, found);
					continue;
				}
				if (typeof node !== 'object') continue;
				const className = node.props === undefined || typeof node.props.className !== 'string' ? '' : node.props.className;
				if (predicate(node.type, className) === true) found.push(node);
				if (node.children !== undefined) collect(node.children, predicate, found);
				if (node.props !== undefined && node.props.children !== undefined) collect([node.props.children], predicate, found);
			}
			return found;
		};
		const figures = collect(mdNodes, (type, className) => type === 'figure' && className.indexOf('ne-mdCode') >= 0, []);
		const tables = collect(mdNodes, (type) => type === 'table', []);
		const rules = collect(mdNodes, (type) => type === 'hr', []);
		const tokens = collect(mdNodes, (type, className) => className.indexOf('ne-mdTokKw') === 0 || className.indexOf('ne-mdTokStr') === 0 || className.indexOf('ne-mdTokDec') === 0, []);
		const tableRows = collect(tables, (type) => type === 'tr', []);
		check('markdown renders One Dark code blocks', figures.length === 1);
		check('markdown code blocks are token-highlighted', tokens.length >= 4, 'tokens=' + String(tokens.length));
		check('markdown renders GFM tables', tables.length === 1 && tableRows.length === 3, 'rows=' + String(tableRows.length));
		check('markdown renders horizontal rules', rules.length === 1);
	} else {
		check('markdown renderer exposed', false);
	}

	// Saved-version flow: the editor must be persisted BEFORE the module-busy
	// guard flips on, otherwise saveFile() silently refuses the write.
	const playgroundViewSource = fs.readFileSync(path.join(root, 'src', 'views', 'playground.js'), 'utf8');
	const snapshotStart = playgroundViewSource.indexOf('const performSnapshotSave');
	const saveCall = snapshotStart >= 0 ? playgroundViewSource.indexOf('await saveFile()', snapshotStart) : -1;
	const busyCall = snapshotStart >= 0 ? playgroundViewSource.indexOf('beginModuleOperation();', snapshotStart) : -1;
	check('saved-version flow saves the editor before marking the module busy', saveCall > 0 && busyCall > 0 && saveCall < busyCall);

	// Chat transcript: duplicated deliveries / live drafts must not duplicate rows.
	if (typeof exposed.nestFoldEntries === 'function' && typeof exposed.nestAppendEntry === 'function') {
		const ev = (seq, type, data) => ({ event: { seq, type, time: seq, data } });
		const durable = ev(5, 'assistant/message', {
			turn: 1,
			step: 1,
			message: { id: 'm1', content: [{ type: 'text', text: '完整的回复内容在这里，足够长以匹配流式前缀。' }] }
		});
		const chunk = (attemptId, seq, text, turn, step) => ({ seq, type: 'assistant/live-chunk', time: seq, data: { attemptId, turn, step, chunk: { type: 'text-delta', text } } });
		const assistantRows = (entries) => exposed.nestFoldEntries(entries).filter((row) => row.kind === 'assistant');
		check('chat folding collapses a replayed durable message', assistantRows([durable, durable]).length === 1);
		check('chat folding collapses duplicate message ids', assistantRows([durable, Object.assign({}, durable, { event: Object.assign({}, durable.event, { seq: 9 }) })]).length === 1);
		const liveAndDurable = assistantRows([
			{ type: 'transient', event: chunk('a1', 1, '完整的回复内容在这里，', -1, -1) },
			{ type: 'transient', event: chunk('a1', 2, '足够长以匹配流式前缀。', -1, -1) },
			durable
		]);
		check('chat folding drops a live draft superseded by the final message', liveAndDurable.length === 1 && liveAndDurable[0].streaming !== true);
		check('chat folding keeps a genuinely streaming draft', assistantRows([{ type: 'transient', event: chunk('a2', 1, '还在输出中', -1, -1) }]).length === 1);
		let appended = [];
		appended = exposed.nestAppendEntry(appended, { type: 'transient', event: chunk('a3', 1, 'x', 1, 1) });
		appended = exposed.nestAppendEntry(appended, { type: 'transient', event: chunk('a3', 1, 'x', 1, 1) });
		check('chat stream drops a replayed live chunk', appended.length === 1);
		let durableEntries = [];
		durableEntries = exposed.nestAppendEntry(durableEntries, durable);
		durableEntries = exposed.nestAppendEntry(durableEntries, durable);
		check('chat stream drops a replayed durable event', durableEntries.length === 1);
	} else {
		check('chat folding helpers exposed', false);
	}

	// Render the real generated knowledge base through every view: this is the
	// closest offline check to the deployed panel content.
	if (fs.existsSync(dataPath)) {
		const real = readJson(dataPath);
		const realKb = { meta: real.meta, chapters: real.chapters, pages: real.pages };
		const firstRealPage = Object.keys(real.pages)[0];
		const realRenders = [
			['knowledge view with generated data', exposed.NestKnowledgeView, { t: fakeT, kb: realKb, initialPageId: firstRealPage, onAskAi() {}, onOpenPage() {} }],
			['enterprise map view with generated data', exposed.NestEnterpriseMapView, { t: fakeT, map: real.enterpriseMap, onAskAi() {}, onOpenPage() {} }],
			['learning route view with generated data', exposed.NestLearningRouteView, { t: fakeT, route: real.learningRoute, progress: {}, onToggleItem() {}, onAskAi() {}, onOpenPage() {} }]
		];
		for (const [label, component, props] of realRenders) {
			let caught = null;
			try {
				renderTree(component(props), 0);
			} catch (error) {
				caught = error;
			}
			check(label + ' renders', caught === null, caught === null ? '' : caught.stack);
		}
	}
}

// ---- 5. Host manifest/syntax ----------------------------------------------
console.log('host half');
const packageJson = readJson(path.join(root, 'package.json'));
check('manifest declares bundle patch', packageJson.dsh !== undefined && packageJson.dsh.bundle !== undefined && packageJson.dsh.bundle.patch === './cordis.patch.yml');
check('manifest declares client half', packageJson.dsh.client !== undefined && packageJson.dsh.client.platform === 'web');
check('manifest exports client/locale/icon', packageJson.exports['./client'] === './client.js' && packageJson.exports['./icon'] === './icon.svg');
try {
	vm.compileFunction(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), [], { filename: 'index.js' });
	check('host index.js parses', true);
} catch (error) {
	// index.js is an ES module; vm.compileFunction cannot parse import syntax.
	const hasImport = /^\s*import\s/m.test(fs.readFileSync(path.join(root, 'index.js'), 'utf8'));
	check('host index.js parses', hasImport, error.message);
}
check('locale zh metadata', readJson(path.join(root, 'locale', 'zh.json')).meta.title === 'NestJS 助手');
check('icon exists', fs.existsSync(path.join(root, 'icon.svg')) && fs.statSync(path.join(root, 'icon.svg')).size < 256 * 1024);

console.log('');
console.log(String(checks - failures) + '/' + String(checks) + ' checks passed' + (failures === 0 ? '' : ', ' + String(failures) + ' FAILED'));
if (failures > 0) process.exitCode = 1;
