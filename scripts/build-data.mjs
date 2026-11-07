// Merge the per-agent knowledge parts into the single runtime knowledge file.
//
// Inputs:
//   knowledge/_index.json        canonical docs page list (generated from the official docs repo)
//   knowledge/parts/*.json       per-page summaries produced by the content agents
//   knowledge/enterprise-map.json
//   knowledge/learning-route.json
// Output:
//   knowledge/data.json          served by the Host half to the Client panel and nest_docs tool
//
// Usage: node scripts/build-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const knowledgeDir = path.join(root, 'knowledge');
const partsDir = path.join(knowledgeDir, 'parts');

const index = JSON.parse(fs.readFileSync(path.join(knowledgeDir, '_index.json'), 'utf8'));
const known = new Map(index.pages.map((page) => [page.id, page]));

/** Chinese chapter titles, kept in the data (not the client dictionary) so the tool uses them too. */
const CHAPTER_ZH = {
	introduction: '介绍',
	overview: '概览',
	fundamentals: '基础',
	application: '应用特性',
	data: '数据访问',
	security: '安全',
	http: 'HTTP',
	observability: '可观测性',
	reliability: '可靠性',
	graphql: 'GraphQL',
	websockets: 'WebSockets',
	mcp: 'MCP',
	ai: 'AI',
	microservices: '微服务',
	deployment: '部署',
	'standalone-apps': '独立应用',
	cli: 'CLI',
	openapi: 'OpenAPI',
	recipes: '实战配方',
	faq: '常见问题',
	devtools: '开发工具',
	'migration-guide': '迁移指南',
	discover: '生态',
	'support-us': '支持我们',
	appendix: '附录'
};

const CHAPTER_INTRO = {
	introduction: 'NestJS 是什么、设计哲学、安装与生态定位。',
	overview: '请求生命周期上的核心构件：控制器、Provider、模块、中间件、过滤器、管道、守卫、拦截器、自定义装饰器。',
	fundamentals: '依赖注入与模块系统的进阶主题：自定义 Provider、异步 Provider、动态模块、注入作用域、循环依赖、执行上下文、生命周期、测试。',
	application: '应用层能力：配置、校验、序列化、日志、事件、定时任务、队列、HTTP 客户端、国际化、邮件、文件存储。',
	data: '数据库与缓存：TypeORM、Drizzle、MongoDB、Prisma、MikroORM、Sequelize 以及缓存策略。',
	security: '认证、授权、加密哈希、安全响应头、CORS、CSRF、限流。',
	http: 'HTTP 层专题：版本化、Cookie、Session、文件上传与流、压缩、SSE、MVC、适配器、Webhook。',
	observability: '可观测性：SDK、手工埋点、分布式链路、错误监控、Dashboard、生产规则、MCP 与 OpenTelemetry。',
	reliability: '可靠性模式：弹性、幂等键、事务性发件箱、持久化工作流、分布式锁、健康检查。',
	graphql: '官方 GraphQL 支持：快速开始、Resolver、变更、订阅、标量、指令、联合、插件、复杂度、Federation。',
	websockets: 'WebSocket 网关及其过滤器、管道、守卫、拦截器与适配器。',
	mcp: 'Model Context Protocol：概览、原语、传输、测试与迁移。',
	ai: 'NestJS 内置 AI 能力：模型、工具、Agent 与测试。',
	microservices: '微服务：传输器（Redis/MQTT/NATS/RabbitMQ/Kafka/gRPC）、自定义传输、过滤器、管道、守卫、拦截器、预请求钩子。',
	deployment: '生产部署要点与 Docker 化实践。',
	'standalone-apps': '不依赖 HTTP 的独立应用（CLI、定时任务、Worker）。',
	cli: 'Nest CLI：概览、Workspace/Monorepo、库、命令参考与脚本。',
	openapi: 'OpenAPI/Swagger 文档：类型与参数、操作、安全、映射类型、装饰器、CLI 插件。',
	recipes: '官方实战配方：REPL、CRUD 生成器、SWC、Passport、热重载、路由模块、CQRS、静态服务、Next.js、Commander、AsyncLocalStorage 等。',
	faq: '常见问题：Serverless、适配器、Keep-Alive、全局前缀、Raw body、混合应用、HTTPS、请求生命周期、常见错误。',
	devtools: 'Devtools 概览与 CI/CD 集成。',
	'migration-guide': '从 Nest v10 迁移到 v11 的要点。',
	discover: '谁在使用 NestJS。',
	'support-us': '支持 NestJS 项目。',
	appendix: '官方文档仓库中不属于主目录的其它页面。'
};

/** Load every part file (arrays of page objects). */
function loadParts() {
	const pages = new Map();
	const problems = [];
	const duplicates = [];
	if (!fs.existsSync(partsDir)) return { pages, problems: ['missing knowledge/parts directory'], duplicates };
	for (const file of fs.readdirSync(partsDir).sort()) {
		if (!file.endsWith('.json')) continue;
		const filePath = path.join(partsDir, file);
		let data;
		try {
			data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
		} catch (error) {
			problems.push(file + ': invalid JSON (' + error.message + ')');
			continue;
		}
		if (!Array.isArray(data)) {
			problems.push(file + ': top level is not an array');
			continue;
		}
		for (const page of data) {
			if (page === null || typeof page !== 'object' || typeof page.id !== 'string') {
				problems.push(file + ': page without string id');
				continue;
			}
			if (pages.has(page.id)) {
				duplicates.push(page.id + ' (' + file + ')');
				continue;
			}
			if (!known.has(page.id)) {
				problems.push(file + ': unknown page id "' + page.id + '"');
				continue;
			}
			pages.set(page.id, page);
		}
	}
	return { pages, problems, duplicates };
}

const loaded = loadParts();
const missing = index.pages.filter((page) => !loaded.pages.has(page.id)).map((page) => page.id);

const enterpriseMap = (() => {
	try {
		return JSON.parse(fs.readFileSync(path.join(knowledgeDir, 'enterprise-map.json'), 'utf8'));
	} catch (_error) {
		return null;
	}
})();
const learningRoute = (() => {
	try {
		return JSON.parse(fs.readFileSync(path.join(knowledgeDir, 'learning-route.json'), 'utf8'));
	} catch (_error) {
		return null;
	}
})();

/** Cross-check pageRefs/pageIds in the generated content. */
function checkRefs(value, label, out, seen) {
	if (typeof value === 'string') return;
	if (Array.isArray(value)) {
		for (const entry of value) checkRefs(entry, label, out, seen);
		return;
	}
	if (value === null || typeof value !== 'object') return;
	for (const [key, entry] of Object.entries(value)) {
		if ((key === 'pageRefs' || key === 'pageIds') && Array.isArray(entry)) {
			for (const id of entry) {
				if (typeof id !== 'string') continue;
				const ref = { scope: label, id };
				const token = label + '|' + id;
				if (!seen.has(token)) {
					seen.add(token);
					if (!known.has(id)) out.push(ref);
				}
			}
			continue;
		}
		checkRefs(entry, label, out, seen);
	}
}
const badRefs = [];
const refSeen = new Set();
checkRefs(enterpriseMap, 'enterprise-map', badRefs, refSeen);
checkRefs(learningRoute, 'learning-route', badRefs, refSeen);

/** Build the served data object. */
const pages = {};
for (const entry of index.pages) {
	const source = loaded.pages.get(entry.id);
	const page = source === undefined ? {
		id: entry.id,
		title: entry.title,
		titleZh: entry.title,
		summary: '（该页内容尚未生成）',
		sections: [],
		keyPoints: [],
		snippets: [],
		api: [],
		pitfalls: [],
		enterprise: '',
		related: []
	} : Object.assign({}, source);
	page.id = entry.id;
	page.path = entry.path;
	page.source = entry.source;
	page.title = page.title === undefined || page.title === '' ? entry.title : page.title;
	page.titleZh = page.titleZh === undefined || page.titleZh === '' ? entry.title : page.titleZh;
	page.chapter = entry.chapter;
	page.chapterTitle = entry.title;
	page.chapterTitleZh = CHAPTER_ZH[entry.chapter] === undefined ? entry.chapter : CHAPTER_ZH[entry.chapter];
	page.officialUrl = entry.path === null ? 'https://docs.nestjs.com/' : 'https://docs.nestjs.com' + (entry.path === '/' ? '/' : entry.path);
	page.related = Array.isArray(page.related) ? page.related.filter((id) => known.has(id)) : [];
	pages[entry.id] = page;
}

const chapters = index.chapters.map((chapter) => ({
	id: chapter.id,
	title: chapter.title,
	titleZh: CHAPTER_ZH[chapter.id] === undefined ? chapter.title : CHAPTER_ZH[chapter.id],
	introZh: CHAPTER_INTRO[chapter.id] === undefined ? '' : CHAPTER_INTRO[chapter.id],
	items: chapter.items.map((id) => {
		const page = pages[id];
		return { id, title: page.title, titleZh: page.titleZh };
	})
}));

const data = {
	meta: {
		generatedAt: new Date().toISOString(),
		source: {
			repo: 'https://github.com/nestjs/docs.nestjs.com',
			branch: 'master',
			site: 'https://docs.nestjs.com',
			contentFiles: index.source.contentFiles,
			pageCount: index.pages.length
		},
		counts: {
			pages: Object.keys(pages).length,
			chapters: chapters.length,
			snippets: Object.values(pages).reduce((sum, page) => sum + (Array.isArray(page.snippets) ? page.snippets.length : 0), 0),
			keyPoints: Object.values(pages).reduce((sum, page) => sum + (Array.isArray(page.keyPoints) ? page.keyPoints.length : 0), 0),
			enterpriseDomains: enterpriseMap !== null && Array.isArray(enterpriseMap.domains) ? enterpriseMap.domains.length : 0,
			routeStages: learningRoute !== null && Array.isArray(learningRoute.stages) ? learningRoute.stages.length : 0
		}
	},
	chapters,
	pages,
	enterpriseMap,
	learningRoute
};

fs.writeFileSync(path.join(knowledgeDir, 'data.json'), JSON.stringify(data));

console.log('knowledge/data.json written');
console.log('  pages: ' + String(Object.keys(pages).length) + ' / ' + String(index.pages.length));
console.log('  chapters: ' + String(chapters.length));
console.log('  enterprise map: ' + (enterpriseMap === null ? 'MISSING' : String((enterpriseMap.domains || []).length) + ' domains'));
console.log('  learning route: ' + (learningRoute === null ? 'MISSING' : String((learningRoute.stages || []).length) + ' stages'));
if (missing.length > 0) console.log('  missing pages (' + String(missing.length) + '): ' + missing.slice(0, 30).join(', ') + (missing.length > 30 ? ' …' : ''));
if (loaded.problems.length > 0) console.log('  problems (' + String(loaded.problems.length) + '):\n   - ' + loaded.problems.slice(0, 20).join('\n   - '));
if (loaded.duplicates.length > 0) console.log('  duplicate ids (' + String(loaded.duplicates.length) + '): ' + loaded.duplicates.slice(0, 20).join(', '));
if (badRefs.length > 0) console.log('  unknown page refs (' + String(badRefs.length) + '): ' + badRefs.slice(0, 20).map((ref) => ref.scope + ':' + ref.id).join(', '));
if (missing.length > 0 || loaded.problems.length > 0 || badRefs.length > 0) process.exitCode = 1;
