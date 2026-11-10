/**
 * Host half of the NestJS Assistant bundle (`@local/nest-assistant`).
 *
 * Responsibilities:
 * 1. Load the built-in knowledge base (`knowledge/data.json`, generated from the
 *    complete official NestJS docs by `scripts/build-data.mjs`) and expose it to
 *    the Client half over a same-origin HTTP API under `/nest-assistant/api`.
 * 2. Register the model-facing `nest_docs` tool + a system-prompt section so the
 *    agent answers NestJS questions from the embedded knowledge instead of
 *    re-querying the web.
 * 3. Own the virtual NestJS runtime used by the playground: the Client edits
 *    TypeScript files, the Host compiles them with the pre-installed TypeScript
 *    compiler, boots the real Nest application with the bundled Node runtime and
 *    proxies HTTP requests into it (`host/playground-runtime.js`).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlaygroundRuntime } from './host/playground-runtime.js';
import { createProjectStore } from './host/playground-projects.js';

/** Cordis plugin name. */
export const name = 'nest-assistant';

/** Required Host services. */
export const inject = ['webServer', 'connection', 'tools', 'systemPrompt'];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = HERE;
const KNOWLEDGE_PATH = path.join(PLUGIN_ROOT, 'knowledge', 'data.json');
const TEMPLATE_DIR = path.join(PLUGIN_ROOT, 'host', 'playground-template');
const PLAYGROUND_DIR = path.join(PLUGIN_ROOT, 'playground');
const MODULES_DIR = path.join(PLUGIN_ROOT, 'playground-modules');
const SAVES_DIR = path.join(PLUGIN_ROOT, 'playground-saves');
const STATE_FILE = path.join(PLUGIN_ROOT, 'playground-state.json');
const API_PREFIX = '/nest-assistant/api';
const MAX_BODY_BYTES = 512 * 1024;

// #region knowledge loading
/** Read one JSON file, returning null when it is missing or malformed. */
function readJsonFile(file) {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (_error) {
		return null;
	}
}

/** Load the merged knowledge base; tolerate a missing generated file so the panel can report it. */
function loadKnowledge() {
	const data = readJsonFile(KNOWLEDGE_PATH);
	if (data !== null && typeof data === 'object' && data.pages !== undefined) {
		return {
			ok: true,
			meta: data.meta === undefined ? {} : data.meta,
			chapters: Array.isArray(data.chapters) ? data.chapters : [],
			pages: data.pages !== null && typeof data.pages === 'object' ? data.pages : {},
			enterpriseMap: data.enterpriseMap === undefined ? null : data.enterpriseMap,
			learningRoute: data.learningRoute === undefined ? null : data.learningRoute
		};
	}
	const index = readJsonFile(path.join(PLUGIN_ROOT, 'knowledge', '_index.json'));
	return {
		ok: false,
		error: '知识库数据 knowledge/data.json 尚未生成（运行 scripts/build-data.mjs）',
		meta: { pageCount: index === null ? 0 : (Array.isArray(index.pages) ? index.pages.length : 0) },
		chapters: index === null ? [] : (Array.isArray(index.chapters) ? index.chapters : []).map((chapter) => ({ id: chapter.id, title: chapter.title, titleZh: chapter.title, items: (chapter.items || []).map((id) => ({ id, title: id, titleZh: id })) })),
		pages: {},
		enterpriseMap: null,
		learningRoute: null
	};
}
// #endregion

// #region knowledge cache
/** Cached knowledge snapshot keyed by the generated file's mtime. */
let knowledgeCache = { mtimeMs: -1, data: null };

/**
 * Read the current knowledge base, regenerating it from disk when
 * `knowledge/data.json` changes (the build script rewrites it without a
 * plugin restart, so the panel and the tool always see the latest content).
 */
function currentKnowledge() {
	let mtimeMs = -1;
	try {
		mtimeMs = fs.statSync(KNOWLEDGE_PATH).mtimeMs;
	} catch (_error) {
		mtimeMs = -1;
	}
	if (knowledgeCache.data === null || knowledgeCache.mtimeMs !== mtimeMs) {
		knowledgeCache = { mtimeMs, data: loadKnowledge() };
	}
	return knowledgeCache.data;
}
// #endregion

// #region tool text formatting
/** Official docs URL for one page id. */
function pageUrl(id) {
	return 'https://docs.nestjs.com/' + String(id === 'introduction' ? '' : id);
}

/** One search hit line. */
function formatSearchHit(page) {
	const title = page.titleZh === undefined || page.titleZh === '' ? page.title : page.titleZh + '（' + page.title + '）';
	const summary = typeof page.summary === 'string' ? page.summary : '';
	return '- `' + page.id + '` · ' + title + ' — ' + (summary.length > 140 ? summary.slice(0, 139) + '…' : summary);
}

/** Full text of one knowledge page. */
function formatPage(page) {
	const lines = [];
	const title = page.titleZh === undefined || page.titleZh === '' ? page.title : page.titleZh;
	lines.push('# ' + title + '（' + page.title + '）');
	lines.push('');
	lines.push('页面 id：`' + page.id + '` · 官方文档：' + pageUrl(page.id));
	lines.push('');
	if (typeof page.summary === 'string' && page.summary !== '') {
		lines.push('## 总结');
		lines.push(page.summary);
		lines.push('');
	}
	const sections = Array.isArray(page.sections) ? page.sections : [];
	if (sections.length > 0) {
		lines.push('## 核心机制');
		for (const section of sections) {
			lines.push('### ' + String(section.heading === undefined ? '' : section.heading));
			lines.push(String(section.text === undefined ? '' : section.text));
			lines.push('');
		}
	}
	const points = Array.isArray(page.keyPoints) ? page.keyPoints : [];
	if (points.length > 0) {
		lines.push('## 关键要点');
		for (const point of points) lines.push('- ' + String(point));
		lines.push('');
	}
	const snippets = Array.isArray(page.snippets) ? page.snippets : [];
	for (const snippet of snippets) {
		lines.push('## 示例：' + String(snippet.title === undefined ? '' : snippet.title));
		lines.push('```' + String(snippet.lang === undefined ? 'typescript' : snippet.lang));
		lines.push(String(snippet.code === undefined ? '' : snippet.code));
		lines.push('```');
		lines.push('');
	}
	const api = Array.isArray(page.api) ? page.api : [];
	if (api.length > 0) {
		lines.push('## 关键 API');
		lines.push(api.map((entry) => '`' + String(entry) + '`').join('、'));
		lines.push('');
	}
	const pitfalls = Array.isArray(page.pitfalls) ? page.pitfalls : [];
	if (pitfalls.length > 0) {
		lines.push('## 常见坑');
		for (const pitfall of pitfalls) lines.push('- ' + String(pitfall));
		lines.push('');
	}
	if (typeof page.enterprise === 'string' && page.enterprise !== '') {
		lines.push('## 企业级建议');
		lines.push(page.enterprise);
		lines.push('');
	}
	const related = Array.isArray(page.related) ? page.related : [];
	if (related.length > 0) {
		lines.push('相关页面：' + related.map((id) => '`' + String(id) + '`').join('、'));
	}
	return lines.join('\n');
}

/** Table-of-contents text for the whole knowledge base. */
function formatCatalog(knowledge) {
	const lines = ['# NestJS 官方文档知识库目录（' + String(knowledge.meta.pageCount === undefined ? Object.keys(knowledge.pages).length : knowledge.meta.pageCount) + ' 页）', ''];
	for (const chapter of knowledge.chapters) {
		const items = Array.isArray(chapter.items) ? chapter.items : [];
		lines.push('## ' + String(chapter.titleZh === undefined || chapter.titleZh === '' ? chapter.title : chapter.titleZh) + '（' + String(chapter.title) + '）');
		for (const item of items) {
			const page = knowledge.pages[item.id];
			const titleZh = page !== undefined && typeof page.titleZh === 'string' && page.titleZh !== '' ? page.titleZh : (item.titleZh === undefined ? item.title : item.titleZh);
			lines.push('- `' + item.id + '` · ' + titleZh);
		}
		lines.push('');
	}
	return lines.join('\n');
}

/** Enterprise knowledge map text. */
function formatMap(map) {
	if (map === null || typeof map !== 'object') return '企业级开发知识地图数据尚未生成。';
	const lines = ['# ' + String(map.titleZh === undefined ? '企业级 NestJS 开发知识地图' : map.titleZh), '', String(map.intro === undefined ? '' : map.intro), ''];
	const layers = Array.isArray(map.layers) ? map.layers : [];
	for (const layer of layers) {
		lines.push('## 层：' + String(layer.titleZh) + ' — ' + String(layer.description === undefined ? '' : layer.description));
		for (const domain of (Array.isArray(map.domains) ? map.domains : []).filter((entry) => entry.layerId === layer.id)) {
			lines.push('### ' + String(domain.titleZh) + '（' + String(domain.title === undefined ? domain.id : domain.title) + '）');
			lines.push(String(domain.essential === undefined ? '' : domain.essential));
			const practices = Array.isArray(domain.practices) ? domain.practices : [];
			for (const practice of practices) {
				lines.push('- [' + String(practice.level === undefined ? '' : practice.level) + '] ' + String(practice.title) + '：' + String(practice.detail));
				const refs = Array.isArray(practice.pageRefs) ? practice.pageRefs : [];
				if (refs.length > 0) lines.push('  - 相关页面：' + refs.map((ref) => '`' + String(ref) + '`').join('、'));
			}
			const checklist = Array.isArray(domain.checklist) ? domain.checklist : [];
			if (checklist.length > 0) {
				lines.push('检查清单：');
				for (const entry of checklist) lines.push('- [ ] ' + String(entry));
			}
			const anti = Array.isArray(domain.antiPatterns) ? domain.antiPatterns : [];
			if (anti.length > 0) lines.push('反模式：' + anti.join('；'));
			const api = Array.isArray(domain.nestApi) ? domain.nestApi : [];
			if (api.length > 0) lines.push('关键 API：' + api.map((entry) => '`' + String(entry) + '`').join('、'));
			lines.push('');
		}
	}
	return lines.join('\n');
}

/** Learning route text. */
function formatRoute(route) {
	if (route === null || typeof route !== 'object') return '学习路线数据尚未生成。';
	const lines = ['# ' + String(route.titleZh === undefined ? 'NestJS 学习路线' : route.titleZh), '', String(route.intro === undefined ? '' : route.intro), '', '总时长（参考）：' + String(route.totalHours === undefined ? '?' : route.totalHours) + ' 小时', ''];
	for (const stage of (Array.isArray(route.stages) ? route.stages : [])) {
		lines.push('## ' + String(stage.title === undefined ? stage.id : stage.title) + ' · ' + String(stage.weeks === undefined ? '' : stage.weeks));
		lines.push('目标：' + String(stage.goal === undefined ? '' : stage.goal) + '（约 ' + String(stage.hours === undefined ? '?' : stage.hours) + ' 小时）');
		for (const item of (Array.isArray(stage.items) ? stage.items : [])) {
			lines.push('### ' + String(item.title));
			lines.push('目标：' + String(item.goal === undefined ? '' : item.goal));
			const points = Array.isArray(item.points) ? item.points : [];
			for (const point of points) lines.push('- ' + String(point));
			lines.push('交付物：' + String(item.deliverable === undefined ? '' : item.deliverable));
			lines.push('验收标准：' + String(item.accept === undefined ? '' : item.accept));
			const lesson = item.lesson !== null && typeof item.lesson === 'object' ? item.lesson : null;
			if (lesson !== null) {
				if (typeof lesson.intro === 'string' && lesson.intro !== '') lines.push('导读（大白话）：' + lesson.intro);
				if (typeof lesson.bridge === 'string' && lesson.bridge !== '') lines.push('衔接上一章：' + lesson.bridge);
				const steps = Array.isArray(lesson.steps) ? lesson.steps : [];
				for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
					const step = steps[stepIndex];
					lines.push(String(stepIndex + 1) + '. ' + String(step.title === undefined ? '' : step.title) + '：' + String(step.body === undefined ? '' : step.body));
				}
				if (typeof lesson.pitfall === 'string' && lesson.pitfall !== '') lines.push('常见坑：' + lesson.pitfall);
			}
			const pages = Array.isArray(item.pageIds) ? item.pageIds : [];
			if (pages.length > 0) lines.push('相关页面：' + pages.map((id) => '`' + String(id) + '`').join('、'));
			lines.push('');
		}
	}
	const checkpoints = Array.isArray(route.checkpoints) ? route.checkpoints : [];
	if (checkpoints.length > 0) {
		lines.push('## 阶段验收');
		for (const checkpoint of checkpoints) lines.push('- ' + String(checkpoint.title) + '：' + String(checkpoint.description));
	}
	return lines.join('\n');
}

/** Split a search query into lowercase tokens (CJK runs stay whole). */
function queryTokens(query) {
	const text = String(query === undefined || query === null ? '' : query).toLowerCase().trim();
	if (text === '') return [];
	const parts = text.split(/[\s,，、;；/]+/).filter((part) => part !== '');
	const tokens = [];
	for (const part of parts) {
		if (/^[a-z0-9@._-]+$/i.test(part)) {
			tokens.push(part);
			continue;
		}
		// For CJK phrases, add the whole phrase plus 2-character shingles so
		// "守卫 执行顺序" can still match content that separates the words.
		tokens.push(part);
		if (part.length > 3) {
			for (let index = 0; index + 2 <= part.length; index += 1) {
				const shingle = part.slice(index, index + 2);
				if (tokens.indexOf(shingle) < 0) tokens.push(shingle);
			}
		}
	}
	return tokens;
}

/** Search the knowledge base. */
function searchKnowledge(knowledge, query, limit) {
	const tokens = queryTokens(query);
	if (tokens.length === 0) return [];
	const scored = [];
	for (const page of Object.values(knowledge.pages)) {
		const title = String(page.titleZh === undefined ? page.title : page.titleZh).toLowerCase();
		const en = String(page.title === undefined ? '' : page.title).toLowerCase();
		const summary = String(page.summary === undefined ? '' : page.summary).toLowerCase();
		const points = (Array.isArray(page.keyPoints) ? page.keyPoints : []).map((point) => String(point).toLowerCase());
		const api = (Array.isArray(page.api) ? page.api : []).map((entry) => String(entry).toLowerCase());
		const enterprise = String(page.enterprise === undefined ? '' : page.enterprise).toLowerCase();
		let score = 0;
		let matched = 0;
		for (const token of tokens) {
			let hit = 0;
			if (title === token) hit += 150;
			else if (title.indexOf(token) >= 0) hit += 90;
			if (en.indexOf(token) >= 0) hit += 60;
			if (summary.indexOf(token) >= 0) hit += 26;
			let pointHits = 0;
			for (const point of points) if (point.indexOf(token) >= 0) pointHits += 1;
			if (pointHits > 0) hit += 12 + Math.min(pointHits, 3) * 4;
			if (api.some((entry) => entry.indexOf(token) >= 0)) hit += 10;
			if (enterprise.indexOf(token) >= 0) hit += 6;
			if (hit > 0) {
				matched += 1;
				score += hit;
			}
		}
		if (matched === 0) continue;
		score += matched * 20;
		scored.push({ page, score });
	}
	scored.sort((left, right) => right.score - left.score);
	const max = typeof limit === 'number' && limit > 0 ? Math.min(limit, 20) : 8;
	return scored.slice(0, max);
}
// #endregion

// #region nest_docs tool
/** Guidance describing the plugin, its tool and the playground to every agent. */
const KNOWLEDGE_GUIDANCE = `## NestJS knowledge base and playground
The Harness Web UI has a "NestJS 助手" panel in the left sidebar with four tabs: 知识全貌 (the embedded knowledge base), 企业地图 (enterprise development map), 学习路线 (learning route) and 操练场 (a two-pane playground with a real virtual NestJS runtime: editable project files, a Run button, an HTTP request console and an AI coach chat).

The complete NestJS official documentation (every page under docs.nestjs.com) is summarized inside this plugin. Use the \`nest_docs\` tool for NestJS questions instead of searching the web:
- \`action: "search"\` with \`query\` — find pages by keyword/API name/topic;
- \`action: "read"\` with \`id\` — read one page's full summary, key points, snippets, pitfalls and enterprise advice;
- \`action: "list"\` — the chapter/page table of contents;
- \`action: "map"\` — the enterprise development knowledge map;
- \`action: "route"\` — the staged learning route.

Prefer the knowledge base for framework usage; only use the web for breaking changes newer than the embedded docs. When the user is working in the playground, guide them to edit files, click 运行 and send HTTP requests in the panel.

When teaching NestJS topics, stay concrete and step by step: start from what the user has already built (their current learning-route item or the file they are editing), explain in plain language before jargon, advance one verifiable step at a time (edit → 运行 → send request → read result) and say what they should see. Do not adopt a persona or role-play.`;

/** Build the model-facing tool definition (plain object: no first-party imports). */
function defineNestDocsTool(getKnowledge) {
	return {
		name: 'nest_docs',
		description: '查询本插件内置的 NestJS 官方文档中文知识库（全部 165 个官方文档页面逐页总结）、企业级开发知识地图与学习路线。action=search 关键词检索；action=read 读取某页完整条目；action=list 目录；action=map 企业地图；action=route 学习路线。回答 NestJS 问题时优先用它，不要每次上网查询官方文档。',
		parameters: {
			type: 'object',
			properties: {
				action: {
					type: 'string',
					enum: ['list', 'search', 'read', 'map', 'route'],
					description: 'list=目录；search=关键词检索；read=读取页面（需要 id）；map=企业级开发知识地图；route=学习路线'
				},
				query: {
					type: 'string',
					description: 'search 的检索词，例如 "守卫 执行顺序"、"ValidationPipe"、"GraphQL subscriptions"'
				},
				id: {
					type: 'string',
					description: 'read 的页面 id，例如 "controllers"、"fundamentals/dynamic-modules"；可先用 list/search 获得'
				},
				limit: {
					type: 'number',
					description: 'search 返回条数上限，默认 8，最大 20'
				}
			},
			required: ['action'],
			additionalProperties: false
		},
		output: {
			schema: { type: 'string' },
			render(_args, value) {
				return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }];
			}
		},
		async execute(args) {
			const input = args !== null && typeof args === 'object' ? args : {};
			const action = typeof input.action === 'string' ? input.action : 'search';
			const knowledge = getKnowledge();
			if (!knowledge.ok) return '知识库尚未生成：' + String(knowledge.error === undefined ? '缺少 knowledge/data.json' : knowledge.error);
			if (action === 'list') return formatCatalog(knowledge);
			if (action === 'map') return formatMap(knowledge.enterpriseMap);
			if (action === 'route') return formatRoute(knowledge.learningRoute);
			if (action === 'read') {
				const id = typeof input.id === 'string' ? input.id.trim() : '';
				if (id === '') return 'read 需要 id 参数；先用 action="search" 或 action="list" 找到页面 id。';
				const page = knowledge.pages[id];
				if (page === undefined) {
					const hits = searchKnowledge(knowledge, id, 5);
					return '未找到页面 `' + id + '`。' + (hits.length > 0 ? '\n相近页面：\n' + hits.map((hit) => formatSearchHit(hit.page)).join('\n') : '请用 list 查看全部页面 id。');
				}
				return formatPage(page);
			}
			const query = typeof input.query === 'string' ? input.query : '';
			if (query.trim() === '') return 'search 需要 query 参数。';
			const hits = searchKnowledge(knowledge, query, input.limit);
			if (hits.length === 0) return '没有匹配「' + query + '」的页面。可以换关键词，或用 list 浏览目录。';
			return '# 检索「' + query + '」的页面\n\n' + hits.map((hit) => formatSearchHit(hit.page)).join('\n') + '\n\n用 action="read" + id 读取完整条目。';
		}
	};
}
// #endregion

// #region node runtime resolution
/** Whether a path is an executable file. */
function isExecutable(file) {
	try {
		fs.accessSync(file, fs.constants.X_OK);
		return fs.statSync(file).isFile();
	} catch (_error) {
		return false;
	}
}

/** Find the Node executable used to boot the playground app. */
function resolveNodePath() {
	const candidates = [];
	const push = (value) => {
		if (typeof value === 'string' && value !== '' && candidates.indexOf(value) < 0) candidates.push(value);
	};
	push(process.env.NEST_ASSISTANT_NODE);
	for (const arg of process.argv) {
		if (typeof arg !== 'string') continue;
		if (arg.endsWith('/node/bin/node') || arg.endsWith('\\node\\bin\\node.exe')) push(arg);
		if (arg.endsWith('/runtime/bin/node')) push(arg);
		if (arg.endsWith('/runtime/bin')) push(path.join(arg, 'node'));
		if (arg.endsWith('/primary-runtime')) push(path.join(arg, 'dependencies', 'node', 'bin', 'node'));
		if (arg.endsWith('/runtime/primary-runtime')) push(path.join(arg, 'dependencies', 'node', 'bin', 'node'));
	}
	const dshHome = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : path.join(os.homedir(), '.dsh');
	try {
		const runtimes = path.join(dshHome, 'dsh-runtimes');
		for (const entry of fs.readdirSync(runtimes)) {
			push(path.join(runtimes, entry, 'dependencies', 'node', 'bin', 'node'));
		}
	} catch (_error) {
		/* no managed runtimes */
	}
	const pathDirs = String(process.env.PATH === undefined ? '' : process.env.PATH).split(path.delimiter);
	for (const dir of pathDirs) {
		if (dir.trim() === '') continue;
		push(path.join(dir, 'node'));
	}
	for (const candidate of candidates) {
		if (isExecutable(candidate)) return { path: candidate, shim: false };
	}
	// Last resort: the Electron Host executable can run as Node with ELECTRON_RUN_AS_NODE.
	if (typeof process.execPath === 'string' && isExecutable(process.execPath)) {
		try {
			const shimPath = path.join(HERE, 'node-shim.sh');
			fs.writeFileSync(shimPath, '#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexec ' + JSON.stringify(process.execPath) + ' --expose-internals "$@"\n', 'utf8');
			fs.chmodSync(shimPath, 0o755);
			return { path: shimPath, shim: true };
		} catch (_error) {
			/* fall through */
		}
	}
	return { path: 'node', shim: false };
}
// #endregion

// #region http helpers
/** Write one JSON response. */
function sendJson(res, status, payload) {
	res.statusCode = status;
	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.setHeader('cache-control', 'no-store');
	res.end(JSON.stringify(payload));
}

/** Read one bounded JSON request body. */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		let failed = false;
		req.on('data', (chunk) => {
			if (failed) return;
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				failed = true;
				reject(new Error('请求体超过 512KB 限制'));
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => {
			if (failed) return;
			const text = Buffer.concat(chunks).toString('utf8').trim();
			if (text === '') {
				resolve({});
				return;
			}
			try {
				const parsed = JSON.parse(text);
				resolve(parsed !== null && typeof parsed === 'object' ? parsed : {});
			} catch (_error) {
				reject(new Error('请求体不是合法 JSON'));
			}
		});
		req.on('error', (error) => {
			if (!failed) reject(error);
		});
	});
}
// #endregion

// #region plugin
/**
 * Register the Host half: knowledge API routes, the agent tool, prompt guidance
 * and the playground runtime.
 * @param ctx - Host context carrying webServer, connection, tools and systemPrompt.
 */
export function apply(ctx) {
	const getKnowledge = () => currentKnowledge();
	const node = resolveNodePath();
	const runtime = createPlaygroundRuntime({
		rootDir: PLAYGROUND_DIR,
		templateDir: TEMPLATE_DIR,
		nodePath: node.path,
		log(line) {
			try {
				if (ctx.logger !== undefined && typeof ctx.logger.debug === 'function') ctx.logger.debug('[nest-assistant] ' + line);
			} catch (_error) {
				/* logging is best-effort */
			}
		}
	});
	const store = createProjectStore({
		pluginRoot: PLUGIN_ROOT,
		rootDir: PLAYGROUND_DIR,
		templateDir: TEMPLATE_DIR,
		modulesDir: MODULES_DIR,
		savesDir: SAVES_DIR,
		stateFile: STATE_FILE,
		runtime,
		log(line) {
			try {
				if (ctx.logger !== undefined && typeof ctx.logger.debug === 'function') ctx.logger.debug('[nest-assistant] ' + line);
			} catch (_error) {
				/* logging is best-effort */
			}
		}
	});
	/** Ensure the project store at most once per plugin instance (first playground request). */
	let storeReady = null;
	const ensureStore = () => {
		if (storeReady === null) {
			storeReady = store.ensure().catch((error) => {
				storeReady = null;
				throw error;
			});
		}
		return storeReady;
	};

	ctx.effect(() => () => {
		try {
			runtime.dispose();
		} catch (_error) {
			/* disposal is best-effort */
		}
	}, 'nest-assistant: playground runtime disposal');

	ctx.effect(() => ctx.systemPrompt.section({
		name: 'nest-assistant:knowledge',
		order: 3260,
		text: KNOWLEDGE_GUIDANCE
	}), 'nest-assistant: prompt guidance');

	ctx.effect(() => ctx.tools.register(defineNestDocsTool(getKnowledge)), 'nest-assistant: nest_docs tool');

	const connection = ctx.get('connection');
	/** Answer an untrusted/unauthenticated request; true when it was rejected. */
	const rejected = (req, res) => {
		try {
			if (connection === undefined || typeof connection.requestRejection !== 'function') return false;
			const rejection = connection.requestRejection(req);
			if (rejection === undefined || rejection === null) return false;
			res.statusCode = rejection;
			res.end();
			return true;
		} catch (_error) {
			return false;
		}
	};

	const handle = async (req, res) => {
		if (rejected(req, res)) return;
		let route = '';
		try {
			const url = new URL(String(req.url === undefined ? '/' : req.url), 'http://localhost');
			route = url.pathname.slice(API_PREFIX.length);
			if (route === '') route = '/';
			const method = String(req.method === undefined ? 'GET' : req.method).toUpperCase();
			if (route.startsWith('/playground/')) await ensureStore();
			if (method === 'GET' && route === '/kb') {
				sendJson(res, 200, { ok: true, knowledge: getKnowledge(), runtime: { nodePath: node.path, shim: node.shim } });
				return;
			}
			if (method === 'GET' && route === '/status') {
				sendJson(res, 200, { ok: true, runtime: await runtime.status(), nodePath: node.path, knowledgeReady: getKnowledge().ok === true });
				return;
			}
			if (method === 'GET' && route === '/playground/modules') {
				sendJson(res, 200, { ok: true, ...(await store.listModules()) });
				return;
			}
			if (method === 'POST' && route === '/playground/module') {
				const body = await readJsonBody(req);
				if (typeof body.moduleId !== 'string' || body.moduleId.trim() === '') throw new Error('缺少 moduleId');
				await runtime.stop();
				sendJson(res, 200, { ok: true, ...(await store.switchModule(body.moduleId)) });
				return;
			}
			if (method === 'POST' && route === '/playground/version') {
				const body = await readJsonBody(req);
				if (typeof body.kind !== 'string' || body.kind === '') throw new Error('缺少 kind');
				await runtime.stop();
				sendJson(res, 200, { ok: true, ...(await store.loadVersion(body.kind, body.snapshotId)) });
				return;
			}
			if (method === 'POST' && route === '/playground/snapshot') {
				const body = await readJsonBody(req);
				if (typeof body.name !== 'string' || body.name.trim() === '') throw new Error('缺少 name');
				await runtime.stop();
				sendJson(res, 200, { ok: true, ...(await store.saveSnapshot(body.name)) });
				return;
			}
			if (method === 'DELETE' && route === '/playground/snapshot') {
				const body = await readJsonBody(req);
				if (typeof body.snapshotId !== 'string' || body.snapshotId === '') throw new Error('缺少 snapshotId');
				sendJson(res, 200, { ok: true, ...(await store.deleteSnapshot(body.snapshotId)) });
				return;
			}
			if (method === 'GET' && route === '/playground/files') {
				sendJson(res, 200, { ok: true, ...(await runtime.listFiles()) });
				return;
			}
			if (method === 'GET' && route === '/playground/file') {
				const file = url.searchParams.get('path');
				if (file === null || file === '') throw new Error('缺少 path 参数');
				sendJson(res, 200, { ok: true, ...(await runtime.readFile(file)) });
				return;
			}
			if (method === 'PUT' && route === '/playground/file') {
				const body = await readJsonBody(req);
				if (typeof body.path !== 'string' || body.path === '') throw new Error('缺少 path');
				if (typeof body.content !== 'string') throw new Error('content 必须是字符串');
				const written = await runtime.writeFile(body.path, body.content);
				store.markDirty();
				sendJson(res, 200, { ok: true, ...written });
				return;
			}
			if (method === 'POST' && route === '/playground/entry') {
				const body = await readJsonBody(req);
				if (typeof body.path !== 'string' || body.path === '') throw new Error('缺少 path');
				const kind = body.kind === 'dir' ? 'dir' : 'file';
				const created = await runtime.createEntry(body.path, kind);
				store.markDirty();
				sendJson(res, 200, { ok: true, ...created });
				return;
			}
			if (method === 'DELETE' && route === '/playground/entry') {
				const body = await readJsonBody(req);
				if (typeof body.path !== 'string' || body.path === '') throw new Error('缺少 path');
				const removed = await runtime.deleteEntry(body.path);
				store.markDirty();
				sendJson(res, 200, { ok: true, ...removed });
				return;
			}
			if (method === 'POST' && route === '/playground/reset') {
				await runtime.stop();
				sendJson(res, 200, { ok: true, ...(await store.resetActive()) });
				return;
			}
			if (method === 'POST' && route === '/playground/run') {
				sendJson(res, 200, { ok: true, ...(await runtime.start()) });
				return;
			}
			if (method === 'GET' && route === '/playground/poll') {
				const runId = url.searchParams.get('runId');
				if (runId === null || runId === '') throw new Error('缺少 runId 参数');
				sendJson(res, 200, { ok: true, run: await runtime.poll(runId) });
				return;
			}
			if (method === 'POST' && route === '/playground/request') {
				const body = await readJsonBody(req);
				if (typeof body.runId !== 'string' || body.runId === '') throw new Error('缺少 runId');
				sendJson(res, 200, { ok: true, response: await runtime.request(body.runId, {
					method: typeof body.method === 'string' ? body.method : 'GET',
					path: typeof body.path === 'string' ? body.path : '/',
					headers: body.headers !== null && typeof body.headers === 'object' ? body.headers : undefined,
					body: typeof body.body === 'string' ? body.body : undefined
				}) });
				return;
			}
			if (method === 'POST' && route === '/playground/stop') {
				sendJson(res, 200, { ok: true, ...(await runtime.stop()) });
				return;
			}
			sendJson(res, 404, { ok: false, error: '未知的插件接口：' + method + ' ' + route });
		} catch (error) {
			sendJson(res, 500, { ok: false, error: error !== null && error !== undefined && typeof error.message === 'string' ? error.message : String(error) });
		}
	};

	ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler: handle }), 'nest-assistant: api route');
}
// #endregion
