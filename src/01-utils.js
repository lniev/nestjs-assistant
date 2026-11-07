// #region utilities
// Pure helpers shared by the panel, the views and the chat plumbing. Everything
// here runs inside the plugin factory closure, so React/h are in scope.

/** Browser storage prefix owned by this plugin. */
const NEST_STORE_PREFIX = 'nest-assistant:';

/** Base path of this bundle's Host API (registered by index.js on the webserver). */
const NEST_API_BASE = '/nest-assistant/api';

/** Stable empty array (reference-stable across renders). */
const NEST_EMPTY = [];

/** Read one JSON value from localStorage; never throws. */
function nestReadStore(key, fallback) {
	try {
		const raw = window.localStorage.getItem(NEST_STORE_PREFIX + key);
		if (raw === null) return fallback;
		const parsed = JSON.parse(raw);
		return parsed === null || parsed === undefined ? fallback : parsed;
	} catch (_error) {
		return fallback;
	}
}

/** Write one JSON value to localStorage; ignores quota/private-mode failures. */
function nestWriteStore(key, value) {
	try {
		window.localStorage.setItem(NEST_STORE_PREFIX + key, JSON.stringify(value));
	} catch (_error) {
		/* storage unavailable: state simply stays session-local */
	}
}

/** Human-readable message of an unknown thrown value. */
function nestErrorMessage(error) {
	if (error === null || error === undefined) return '';
	if (typeof error === 'string') return error;
	if (typeof error.message === 'string' && error.message !== '') return error.message;
	return String(error);
}

/** Fetch one Host API JSON endpoint; unwrap the { ok, ... } envelope and throw readable errors. */
async function nestFetchJson(path, options) {
	const request = Object.assign({ headers: {} }, options === undefined ? {} : options);
	const headers = Object.assign({}, request.headers);
	if (request.body !== undefined && request.body !== null && headers['content-type'] === undefined) {
		headers['content-type'] = 'application/json';
	}
	request.headers = headers;
	let response;
	try {
		response = await fetch(NEST_API_BASE + path, request);
	} catch (error) {
		throw new Error('无法连接插件后端（' + nestErrorMessage(error) + '）');
	}
	let payload = null;
	try {
		payload = await response.json();
	} catch (_error) {
		payload = null;
	}
	if (payload !== null && typeof payload === 'object' && payload.ok === false) {
		throw new Error(typeof payload.error === 'string' && payload.error !== '' ? payload.error : '请求失败（HTTP ' + response.status + '）');
	}
	if (!response.ok) {
		throw new Error('请求失败（HTTP ' + response.status + '）');
	}
	return payload;
}

/** Join the text blocks of one message content array. */
function nestTextOf(content) {
	if (typeof content === 'string') return content.trim();
	if (!Array.isArray(content)) return '';
	const parts = [];
	for (const block of content) {
		if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
			parts.push(block.text);
		}
	}
	return parts.join('\n').trim();
}

/** Truncate one display string on a single line. */
function nestClipText(text, limit) {
	const flat = String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
	if (flat.length <= limit) return flat;
	return flat.slice(0, Math.max(0, limit - 1)) + '…';
}

/** Format one minute count as a compact duration label. */
function nestFormatMinutes(minutes) {
	if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return '';
	if (minutes < 60) return minutes + ' 分钟';
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0 ? hours + ' 小时' : hours + ' 小时 ' + rest + ' 分钟';
}

/** Best-effort client time zone for one prompt request. */
function nestClientTimeZone() {
	try {
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return typeof zone === 'string' && zone !== '' ? zone : undefined;
	} catch (_error) {
		return undefined;
	}
}

/** Unique request id for one prompt admission. */
function nestRequestId() {
	try {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	} catch (_error) {
		/* fall through to the timestamp form */
	}
	return 'nest-assistant-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Format one epoch-ms timestamp as a local `HH:MM`. */
function nestTimeLabel(time) {
	if (typeof time !== 'number' || !Number.isFinite(time)) return '';
	try {
		const date = new Date(time);
		return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
	} catch (_error) {
		return '';
	}
}

/** Interpolate `{name}` placeholders in one dictionary string. */
function nestFormat(template, params) {
	if (typeof template !== 'string') return '';
	if (params === null || params === undefined || typeof params !== 'object') return template;
	return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
		const value = params[key];
		return value === undefined || value === null ? match : String(value);
	});
}

/** Copy text to the clipboard with a legacy fallback; resolves to true on success. */
async function nestCopyText(text) {
	try {
		if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch (_error) {
		/* fall through to the textarea fallback */
	}
	try {
		const area = document.createElement('textarea');
		area.value = text;
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand('copy');
		document.body.removeChild(area);
		return ok === true;
	} catch (_error) {
		return false;
	}
}

/** Inline rich text: `code`, **bold**, and [label](url) links. */
function nestRenderInline(text, keyPrefix) {
	const nodes = [];
	const pattern = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
	const source = typeof text === 'string' ? text : '';
	let cursor = 0;
	let match = pattern.exec(source);
	let index = 0;
	while (match !== null) {
		if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
		const token = match[0];
		const key = keyPrefix + '-i' + String(index);
		index += 1;
		if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
			nodes.push(h('strong', { key }, token.slice(2, -2)));
		} else if (token.startsWith('~~') && token.endsWith('~~') && token.length > 4) {
			nodes.push(h('del', { key, className: 'ne-inlineDel' }, token.slice(2, -2)));
		} else if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
			nodes.push(h('code', { key, className: 'ne-inlineCode' }, token.slice(1, -1)));
		} else {
			const close = token.indexOf('](');
			const label = token.slice(1, close);
			const href = token.slice(close + 2, -1);
			nodes.push(h('a', { key, className: 'ne-inlineLink', href, target: '_blank', rel: 'noreferrer noopener' }, label));
		}
		cursor = pattern.lastIndex;
		match = pattern.exec(source);
	}
	if (cursor < source.length) nodes.push(source.slice(cursor));
	return nodes;
}

/** Languages whose line comments start with `#`. */
const NEST_MD_HASH_LANGS = ['bash', 'sh', 'shell', 'zsh', 'console', 'terminal', 'yaml', 'yml', 'python', 'py', 'dockerfile', 'docker', 'conf', 'ini', 'toml', 'env', 'dotenv', 'makefile', 'nginx'];

/** Languages whose line comments start with `--`. */
const NEST_MD_DASH_LANGS = ['sql', 'mysql', 'postgres', 'postgresql', 'lua', 'hive'];

/** Broad keyword list for the display-only One Dark code highlighter. */
const NEST_MD_KEYWORDS = ('import from export default class extends implements interface type enum const let var function return new async await ' +
	'if else for of in while do switch case break continue try catch finally throw typeof instanceof void null undefined true false ' +
	'this super static readonly public private protected abstract declare namespace module satisfies keyof infer as is get set constructor ' +
	'yield delete select insert update from where join left right inner outer group order by limit offset values into create table alter drop ' +
	'index set begin commit rollback and or not distinct having sum count avg min max when then end echo cd npm npx pnpm node curl grep cat ' +
	'ls mkdir rm cp mv git docker kubectl sudo export then fi done local source find chmod touch head tail sed awk jq ps kill nohup date printf').split(' ');

/** Whether a language uses `#` line comments. */
function nestMdHashComments(lang) {
	return NEST_MD_HASH_LANGS.indexOf(String(lang === undefined ? '' : lang).toLowerCase()) >= 0;
}

/** Whether a language uses `--` line comments. */
function nestMdDashComments(lang) {
	return NEST_MD_DASH_LANGS.indexOf(String(lang === undefined ? '' : lang).toLowerCase()) >= 0;
}

/** Tokenize one code line for the display-only One Dark markdown highlighter. */
function nestRenderCodeLine(line, lang, keyPrefix) {
	const source = typeof line === 'string' ? line : '';
	if (source === '') return h('span', { key: keyPrefix, className: 'ne-mdTokLine' }, ' ');
	const hashComments = nestMdHashComments(lang);
	const dashComments = nestMdDashComments(lang);
	const nodes = [];
	let buffer = '';
	let index = 0;
	let tokenIndex = 0;
	const flush = () => {
		if (buffer !== '') {
			nodes.push(buffer);
			buffer = '';
		}
	};
	const push = (className, text) => {
		flush();
		nodes.push(h('span', { key: keyPrefix + '-t' + String(tokenIndex), className }, text));
		tokenIndex += 1;
	};
	while (index < source.length) {
		const character = source[index];
		const rest = source.slice(index);
		if (rest.startsWith('//') || rest.startsWith('/*')) {
			const end = rest.startsWith('/*') ? (rest.indexOf('*/') >= 0 ? rest.indexOf('*/') + 2 : rest.length) : (rest.indexOf('\n') >= 0 ? rest.indexOf('\n') : rest.length);
			push('ne-mdTokCom', rest.slice(0, end));
			index += end;
			continue;
		}
		if (hashComments && character === '#') {
			push('ne-mdTokCom', rest);
			index = source.length;
			continue;
		}
		if (dashComments && rest.startsWith('--')) {
			push('ne-mdTokCom', rest);
			index = source.length;
			continue;
		}
		if (character === "'" || character === '"' || character === '`') {
			let cursor = index + 1;
			while (cursor < source.length) {
				if (source[cursor] === '\\') {
					cursor += 2;
					continue;
				}
				if (source[cursor] === character) {
					cursor += 1;
					break;
				}
				cursor += 1;
			}
			push('ne-mdTokStr', source.slice(index, cursor));
			index = cursor;
			continue;
		}
		if (character === '@') {
			const decorator = /^@[A-Za-z_$][\w$]*/.exec(rest);
			if (decorator !== null) {
				push('ne-mdTokDec', decorator[0]);
				index += decorator[0].length;
				continue;
			}
		}
		if (character >= '0' && character <= '9') {
			const number = /^\d+(?:\.\d+)?/.exec(rest);
			if (number !== null) {
				push('ne-mdTokNum', number[0]);
				index += number[0].length;
				continue;
			}
		}
		if (/[A-Za-z_$]/.test(character)) {
			const word = /^[A-Za-z_$][\w$]*/.exec(rest)[0];
			const after = source.slice(index + word.length);
			if (NEST_MD_KEYWORDS.indexOf(word.toLowerCase()) >= 0) push('ne-mdTokKw', word);
			else if (/^[ \t]*\(/.test(after)) push('ne-mdTokFn', word);
			else if (/^[A-Z]/.test(word)) push('ne-mdTokType', word);
			else buffer += word;
			index += word.length;
			continue;
		}
		buffer += character;
		index += 1;
	}
	flush();
	return h('span', { key: keyPrefix, className: 'ne-mdTokLine' }, nodes);
}

/** One fenced code block rendered with the One Dark palette (display only). */
function nestRenderCodeBlock(block, keyPrefix) {
	const lang = typeof block.lang === 'string' ? block.lang.trim() : '';
	const lines = String(block.text === undefined ? '' : block.text).split('\n');
	return h('figure', { key: keyPrefix, className: 'ne-mdCode ne-oneDark' },
		h('figcaption', { className: 'ne-mdCodeHead' },
			h('span', { className: 'ne-mdCodeDots', 'aria-hidden': true }, h('i', null), h('i', null), h('i', null)),
			h('span', { className: 'ne-mdCodeLang' }, lang === '' ? 'code' : lang)
		),
		h('pre', { className: 'ne-mdCodePre' }, lines.map((line, index) => nestRenderCodeLine(line, lang, keyPrefix + '-l' + String(index))))
	);
}

/** Split one GFM table row into trimmed cells. */
function nestSplitTableRow(line) {
	let value = String(line === undefined || line === null ? '' : line).trim();
	if (value.startsWith('|')) value = value.slice(1);
	if (value.endsWith('|')) value = value.slice(0, -1);
	return value.split('|').map((cell) => cell.trim());
}

/** Column alignments parsed from a GFM separator row. */
function nestTableAlignments(line) {
	return nestSplitTableRow(line).map((cell) => {
		const value = cell.trim();
		const left = value.startsWith(':');
		const right = value.endsWith(':');
		if (left && right) return 'center';
		if (right) return 'right';
		if (left) return 'left';
		return '';
	});
}

/** Cell style for one alignment. */
function nestTableCellStyle(alignment) {
	if (alignment === 'center') return { textAlign: 'center' };
	if (alignment === 'right') return { textAlign: 'right' };
	return undefined;
}

/**
 * Render lightweight markdown-ish rich text as React nodes: fenced code blocks
 * (One Dark highlighting), headings, GFM tables, horizontal rules, bullet and
 * numbered lists, blockquotes and paragraphs. Links, **bold**, `code` and
 * ~~strikethrough~~ work inline.
 */
function nestRenderRichText(text) {
	const source = typeof text === 'string' ? text.replace(/\r\n?/g, '\n') : '';
	if (source.trim() === '') return [];
	const lines = source.split('\n');
	const blocks = [];
	let paragraph = [];
	let list = null;
	let code = null;
	let codeLang = '';
	const flushParagraph = () => {
		if (paragraph.length === 0) return;
		blocks.push({ type: 'paragraph', lines: paragraph });
		paragraph = [];
	};
	const flushList = () => {
		if (list === null) return;
		blocks.push(list);
		list = null;
	};
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (code !== null) {
			if (/^\s*(?:```|~~~)\s*[\w+#.-]*\s*$/.test(line)) {
				blocks.push({ type: 'code', text: code.join('\n'), lang: codeLang });
				code = null;
				codeLang = '';
			} else {
				code.push(line);
			}
			continue;
		}
		const fence = /^\s*(?:```|~~~)\s*([\w+#.-]*)\s*$/.exec(line);
		if (fence !== null) {
			flushParagraph();
			flushList();
			code = [];
			codeLang = fence[1] === undefined ? '' : fence[1];
			continue;
		}
		/* GFM table: a header row followed by a `|---|:--:|` separator row. */
		if (line.indexOf('|') >= 0 && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[index + 1])) {
			flushParagraph();
			flushList();
			const header = nestSplitTableRow(line);
			const alignments = nestTableAlignments(lines[index + 1]);
			const rows = [];
			let rowIndex = index + 2;
			while (rowIndex < lines.length) {
				const row = lines[rowIndex];
				if (row.trim() === '' || row.indexOf('|') < 0) break;
				if (/^\s*(?:```|~~~|#{1,6}\s|>\s)/.test(row)) break;
				rows.push(nestSplitTableRow(row));
				rowIndex += 1;
			}
			blocks.push({ type: 'table', header, alignments, rows });
			index = rowIndex - 1;
			continue;
		}
		if (/^ {0,3}((?:(?:- *){3,})|(?:(?:\* *){3,})|(?:(?:_ *){3,}))$/.test(line)) {
			flushParagraph();
			flushList();
			blocks.push({ type: 'hr' });
			continue;
		}
		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading !== null) {
			flushParagraph();
			flushList();
			blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
			continue;
		}
		const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
		if (bullet !== null) {
			flushParagraph();
			if (list === null || list.ordered) {
				flushList();
				list = { type: 'list', ordered: false, items: [] };
			}
			list.items.push(bullet[1]);
			continue;
		}
		const ordered = /^\s*\d+[.)、]\s+(.*)$/.exec(line);
		if (ordered !== null) {
			flushParagraph();
			if (list === null || !list.ordered) {
				flushList();
				list = { type: 'list', ordered: true, items: [] };
			}
			list.items.push(ordered[1]);
			continue;
		}
		const quote = /^\s*>\s?(.*)$/.exec(line);
		if (quote !== null) {
			flushParagraph();
			flushList();
			blocks.push({ type: 'quote', text: quote[1] });
			continue;
		}
		if (line.trim() === '') {
			flushParagraph();
			flushList();
			continue;
		}
		flushList();
		paragraph.push(line);
	}
	if (code !== null) blocks.push({ type: 'code', text: code.join('\n'), lang: codeLang });
	flushParagraph();
	flushList();

	const nodes = [];
	let key = 0;
	for (const block of blocks) {
		const blockKey = 'rb-' + String(key);
		key += 1;
		if (block.type === 'paragraph') {
			const children = [];
			for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex += 1) {
				if (lineIndex > 0) children.push(h('br', { key: blockKey + '-br' + String(lineIndex) }));
				const parts = nestRenderInline(block.lines[lineIndex], blockKey + '-l' + String(lineIndex));
				for (const part of parts) children.push(part);
			}
			nodes.push(h('p', { key: blockKey, className: 'ne-richPara' }, children));
		} else if (block.type === 'heading') {
			const level = Math.min(6, block.level + 1);
			nodes.push(h('h' + String(level), { key: blockKey, className: 'ne-richHead' }, nestRenderInline(block.text, blockKey)));
		} else if (block.type === 'list') {
			const items = block.items.map((item, itemIndex) => h('li', { key: blockKey + '-li' + String(itemIndex) }, nestRenderInline(item, blockKey + '-li' + String(itemIndex))));
			nodes.push(h(block.ordered ? 'ol' : 'ul', { key: blockKey, className: 'ne-richList' }, items));
		} else if (block.type === 'quote') {
			nodes.push(h('blockquote', { key: blockKey, className: 'ne-richQuote' }, nestRenderInline(block.text, blockKey)));
		} else if (block.type === 'hr') {
			nodes.push(h('hr', { key: blockKey, className: 'ne-mdHr' }));
		} else if (block.type === 'table') {
			const head = h('tr', { key: blockKey + '-hr' },
				block.header.map((cell, cellIndex) => h('th', { key: blockKey + '-th' + String(cellIndex), style: nestTableCellStyle(block.alignments[cellIndex]) }, nestRenderInline(cell, blockKey + '-th' + String(cellIndex)))));
			const body = block.rows.map((row, rowIndex) => h('tr', { key: blockKey + '-tr' + String(rowIndex) },
				block.header.map((cell, cellIndex) => h('td', { key: blockKey + '-td' + String(rowIndex) + '-' + String(cellIndex), style: nestTableCellStyle(block.alignments[cellIndex]) },
					nestRenderInline(row[cellIndex] === undefined ? '' : row[cellIndex], blockKey + '-td' + String(rowIndex) + '-' + String(cellIndex))))));
			nodes.push(h('div', { key: blockKey, className: 'ne-mdTableWrap' },
				h('table', { className: 'ne-mdTable' },
					h('thead', null, head),
					block.rows.length > 0 ? h('tbody', null, body) : null
				)
			));
		} else if (block.type === 'code') {
			nodes.push(nestRenderCodeBlock(block, blockKey));
		}
	}
	return nodes;
}

/** Simple keyword score used by client-side knowledge search. */
function nestScorePage(page, query) {
	if (page === null || typeof page !== 'object') return 0;
	const needle = query.toLowerCase().trim();
	if (needle === '') return 0;
	let score = 0;
	const title = String(page.titleZh === undefined ? page.title : page.titleZh).toLowerCase();
	const en = String(page.title === undefined ? '' : page.title).toLowerCase();
	const summary = String(page.summary === undefined ? '' : page.summary).toLowerCase();
	if (title.indexOf(needle) === 0) score += 120;
	else if (title.indexOf(needle) >= 0) score += 80;
	if (en.indexOf(needle) >= 0) score += 60;
	if (summary.indexOf(needle) >= 0) score += 30;
	const points = Array.isArray(page.keyPoints) ? page.keyPoints : [];
	for (const point of points) {
		if (String(point).toLowerCase().indexOf(needle) >= 0) score += 12;
	}
	const api = Array.isArray(page.api) ? page.api : [];
	for (const entry of api) {
		if (String(entry).toLowerCase().indexOf(needle) >= 0) score += 10;
	}
	if (String(page.enterprise === undefined ? '' : page.enterprise).toLowerCase().indexOf(needle) >= 0) score += 8;
	return score;
}
// #endregion
