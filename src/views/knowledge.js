// #region knowledge view
// Knowledge overview: the official docs table of contents on the left, the
// summarized content of the selected page on the right. Everything comes from
// the knowledge object the panel fetched from the Host half; the view itself
// never fetches and never touches storage.

const NEST_I18N_KNOWLEDGE = {
	zh: {
		'kb.searchClear': '清空搜索',
		'kb.copiedCode': '已复制',
		'kb.pageCountChip': '{n} 页',
		'kb.officialPage': '官方页面',
		'kb.prevPage': '上一页',
		'kb.nextPage': '下一页',
		'kb.authorNote': '内容由插件内置的知识库提供（逐页总结自 docs.nestjs.com），可用 nest_docs 工具查询。'
	},
	en: {
		'kb.searchClear': 'Clear search',
		'kb.copiedCode': 'Copied',
		'kb.pageCountChip': '{n} pages',
		'kb.officialPage': 'Official page',
		'kb.prevPage': 'Previous',
		'kb.nextPage': 'Next',
		'kb.authorNote': 'Provided by the built-in knowledge base (summarized page by page from docs.nestjs.com); also available to the agent through the nest_docs tool.'
	}
};

/** Flatten the chapter tree into the reading order used by prev/next. */
function nestKbOrder(chapters) {
	const order = [];
	for (const chapter of chapters) {
		for (const item of chapter.items) order.push(item.id);
	}
	return order;
}

/** The official docs table of contents. */
function NestKbToc(props) {
	const t = props.t;
	const kb = props.kb;
	const search = props.search;
	const results = props.results;
	const activeId = props.activeId;
	const openChapters = props.openChapters;
	const onToggleChapter = props.onToggleChapter;
	const onSelectPage = props.onSelectPage;
	const onSearch = props.onSearch;

	return h('aside', { className: 'nek-toc', 'aria-label': t('kb.toc') },
		h('div', { className: 'nek-search' },
			h('div', { className: 'nek-searchBox' },
				h('span', { className: 'nek-searchIcon' }, NestGlyph({ name: 'search', size: 14 })),
				h('input', {
					className: 'nek-searchInput',
					value: search,
					placeholder: t('kb.searchPlaceholder'),
					'aria-label': t('kb.searchPlaceholder'),
					onChange: (event) => onSearch(event.target.value)
				}),
				search === ''
					? null
					: h('button', { className: 'ne-iconBtn nek-searchClear', type: 'button', title: t('kb.searchClear'), 'aria-label': t('kb.searchClear'), onClick: () => onSearch('') }, NestGlyph({ name: 'plus', size: 12 }))
			)
		),
		h('div', { className: 'nek-tocList ne-scroll' },
			search.trim() !== ''
				? h('div', { className: 'nek-results' },
					h('p', { className: 'nek-resultCount' }, t('kb.resultCount', { n: results.length })),
					results.length === 0
						? h('p', { className: 'ne-muted nek-emptyLine' }, t('kb.searchEmpty'))
						: results.map((page) => h('button', {
							key: page.id,
							className: 'nek-resultRow',
							type: 'button',
							'data-active': page.id === activeId ? 'true' : 'false',
							onClick: () => onSelectPage(page.id)
						},
							h('span', { className: 'nek-resultTitle' }, page.titleZh === undefined || page.titleZh === '' ? page.title : page.titleZh),
							h('span', { className: 'nek-resultMeta' }, page.title),
							h('span', { className: 'nek-resultSummary' }, nestClipText(page.summary, 90))
						)))
				: kb.chapters.map((chapter) => {
					const open = openChapters[chapter.id] === true;
					return h('section', { className: 'nek-chapter', key: chapter.id },
						h('button', {
							className: 'nek-chapterHead',
							type: 'button',
							'aria-expanded': open ? 'true' : 'false',
							onClick: () => onToggleChapter(chapter.id)
						},
							h('span', { className: 'nek-chevron', 'data-open': open ? 'true' : 'false' }, NestGlyph({ name: 'chevron', size: 12 })),
							h('span', { className: 'nek-chapterTitle' }, chapter.titleZh),
							h('span', { className: 'nek-chapterEn' }, chapter.title),
							h('span', { className: 'nek-chapterCount' }, String(chapter.items.length))
						),
						open
							? h('div', { className: 'nek-chapterBody' },
								chapter.introZh === undefined || chapter.introZh === '' ? null : h('p', { className: 'nek-chapterIntro' }, chapter.introZh),
								chapter.items.map((item) => h('button', {
									key: item.id,
									className: 'nek-pageRow',
									type: 'button',
									'data-active': item.id === activeId ? 'true' : 'false',
									onClick: () => onSelectPage(item.id)
								},
									h('span', { className: 'nek-pageDot', 'aria-hidden': true }),
									h('span', { className: 'nek-pageLabel' }, item.titleZh === undefined || item.titleZh === '' ? item.title : item.titleZh),
									h('span', { className: 'nek-pageEn' }, item.title)
								)))
							: null
					);
				})
		),
		h('div', { className: 'nek-tocFoot' },
			h('span', { className: 'ne-chip ne-chipSoft' }, t('kb.pageCountChip', { n: props.pageCount })),
			h('span', { className: 'nek-source' }, 'docs.nestjs.com')
		)
	);
}

/** One code snippet block with a copy button. */
function NestKbSnippet(props) {
	const snippet = props.snippet;
	const copied = props.copied;
	const onCopy = props.onCopy;
	return h('div', { className: 'nek-snippet' },
		h('div', { className: 'nek-snippetHead' },
			h('span', { className: 'nek-snippetTitle' }, snippet.title),
			h('div', { className: 'nek-snippetTools' },
				h('span', { className: 'ne-chip ne-chipSoft' }, String(snippet.lang === undefined ? 'typescript' : snippet.lang)),
				h('button', { className: 'ne-btn ne-btnSmall ne-btnGhost', type: 'button', onClick: onCopy },
					NestGlyph({ name: copied ? 'check' : 'copy', size: 12 }),
					h('span', null, copied ? props.t('kb.copiedCode') : props.t('kb.copyCode')))
			)
		),
		h('pre', { className: 'nek-code' }, h('code', null, snippet.code))
	);
}

/** The content column for one page. */
function NestKbPage(props) {
	const t = props.t;
	const page = props.page;
	const chapter = props.chapter;
	const onAskAi = props.onAskAi;
	const onOpenPage = props.onOpenPage;
	const copiedKey = props.copiedKey;
	const setCopiedKey = props.setCopiedKey;

	const copySnippet = async (key, code) => {
		const ok = await nestCopyText(code);
		if (ok) {
			setCopiedKey(key);
			window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1800);
		}
	};

	const points = Array.isArray(page.keyPoints) ? page.keyPoints : [];
	const sections = Array.isArray(page.sections) ? page.sections : [];
	const snippets = Array.isArray(page.snippets) ? page.snippets : [];
	const api = Array.isArray(page.api) ? page.api : [];
	const pitfalls = Array.isArray(page.pitfalls) ? page.pitfalls : [];
	const related = Array.isArray(page.related) ? page.related : [];

	return h('article', { className: 'nek-pageContent', key: page.id },
		h('header', { className: 'nek-pageHead' },
			h('div', { className: 'nek-breadcrumb' },
				chapter === null || chapter === undefined ? null : h('span', { className: 'nek-breadcrumbChapter' }, chapter.titleZh),
				h('span', { className: 'nek-breadcrumbSep' }, '/'),
				h('span', null, String(page.title))
			),
			h('div', { className: 'nek-titleRow' },
				h('h2', { className: 'nek-pageTitle' }, page.titleZh === undefined || page.titleZh === '' ? page.title : page.titleZh),
				h('span', { className: 'nek-pageEnTitle' }, page.title)
			),
			h('div', { className: 'nek-pageActions' },
				h('button', { className: 'ne-btn ne-btnPrimary', type: 'button', onClick: () => onAskAi(page, 'explain') },
					NestGlyph({ name: 'spark', size: 13 }), h('span', null, t('kb.askExplain'))),
				h('button', { className: 'ne-btn', type: 'button', onClick: () => onAskAi(page, 'practice') },
					NestGlyph({ name: 'terminal', size: 13 }), h('span', null, t('kb.askPractice'))),
				typeof page.officialUrl === 'string' && page.officialUrl !== ''
					? h('a', { className: 'ne-btn ne-btnGhost', href: page.officialUrl, target: '_blank', rel: 'noreferrer noopener', title: t('kb.officialPage') },
						NestGlyph({ name: 'external', size: 13 }), h('span', null, t('kb.officialPage')))
					: null
			)
		),
		h('div', { className: 'nek-metaRow' },
			page.chapterTitleZh === undefined ? null : h('span', { className: 'ne-chip ne-chipBrand' }, String(page.chapterTitleZh)),
			h('span', { className: 'ne-chip ne-chipSoft' }, 'id · ' + String(page.id))
		),
		typeof page.summary === 'string' && page.summary !== ''
			? h('section', { className: 'nek-summaryCard' },
				h('h3', { className: 'nek-blockTitle' }, NestGlyph({ name: 'info', size: 13 }), h('span', null, t('kb.summary'))),
				h('p', { className: 'nek-summaryText' }, page.summary))
			: null,
		sections.length > 0
			? h('section', { className: 'nek-block' },
				h('h3', { className: 'nek-blockTitle' }, NestGlyph({ name: 'layers', size: 13 }), h('span', null, t('kb.sections'))),
				h('div', { className: 'nek-sectionGrid' }, sections.map((section, index) => h('div', { className: 'nek-section', key: 's' + String(index) },
					h('h4', { className: 'nek-sectionHeading' }, section.heading),
					h('p', { className: 'nek-sectionText' }, section.text)))))
			: null,
		points.length > 0
			? h('section', { className: 'nek-block' },
				h('h3', { className: 'nek-blockTitle' }, NestGlyph({ name: 'check', size: 13 }), h('span', null, t('kb.keyPoints'))),
				h('ul', { className: 'nek-points' }, points.map((point, index) => h('li', { className: 'nek-point', key: 'p' + String(index) },
					h('span', { className: 'nek-pointIndex' }, String(index + 1)), h('span', null, point)))))
			: null,
		snippets.length > 0
			? h('section', { className: 'nek-block' },
				h('h3', { className: 'nek-blockTitle' }, NestGlyph({ name: 'code', size: 13 }), h('span', null, t('kb.snippets'))),
				h('div', { className: 'nek-snippets' }, snippets.map((snippet, index) => {
					const key = page.id + ':' + String(index);
					return h(NestKbSnippet, {
						key,
						t,
						snippet,
						copied: copiedKey === key,
						onCopy: () => copySnippet(key, snippet.code)
					});
				})))
			: null,
		api.length > 0
			? h('section', { className: 'nek-block' },
				h('h3', { className: 'nek-blockTitle' }, NestGlyph({ name: 'target', size: 13 }), h('span', null, t('kb.api'))),
				h('div', { className: 'ne-pillRow' }, api.map((entry, index) => h('code', { className: 'nek-apiChip', key: 'a' + String(index) }, String(entry)))))
			: null,
		pitfalls.length > 0
			? h('section', { className: 'nek-block' },
				h('h3', { className: 'nek-blockTitle' }, NestGlyph({ name: 'alert', size: 13 }), h('span', null, t('kb.pitfalls'))),
				h('ul', { className: 'nek-pitfalls' }, pitfalls.map((pitfall, index) => h('li', { key: 'x' + String(index) }, h('span', { className: 'nek-pitfallMark' }, '!'), h('span', null, pitfall)))))
			: null,
		typeof page.enterprise === 'string' && page.enterprise !== ''
			? h('section', { className: 'nek-enterpriseCard' },
				h('h3', { className: 'nek-blockTitle' }, NestGlyph({ name: 'shield', size: 13 }), h('span', null, t('kb.enterprise'))),
				h('p', null, page.enterprise))
			: null,
		related.length > 0
			? h('section', { className: 'nek-block' },
				h('h3', { className: 'nek-blockTitle' }, NestGlyph({ name: 'route', size: 13 }), h('span', null, t('kb.related'))),
				h('div', { className: 'ne-pillRow' }, related.map((id) => h('button', {
					key: id,
					className: 'ne-btn ne-btnSmall',
					type: 'button',
					onClick: () => onOpenPage(id)
				}, NestGlyph({ name: 'arrowRight', size: 11 }), h('span', null, id)))))
			: null,
		h('p', { className: 'nek-authorNote' }, t('kb.authorNote'))
	);
}

/** The knowledge overview view. */
function NestKnowledgeView(props) {
	const t = props.t;
	const kb = props.kb;
	const initialPageId = props.initialPageId === undefined ? null : props.initialPageId;
	const onAskAi = typeof props.onAskAi === 'function' ? props.onAskAi : function () {};
	const onOpenPage = typeof props.onOpenPage === 'function' ? props.onOpenPage : function () {};

	const chapters = kb !== null && kb !== undefined && Array.isArray(kb.chapters) ? kb.chapters : NEST_EMPTY;
	const pages = kb !== null && kb !== undefined && kb.pages !== undefined ? kb.pages : {};
	const order = React.useMemo(() => nestKbOrder(chapters), [chapters]);
	const chapterById = React.useMemo(() => {
		const map = {};
		for (const chapter of chapters) map[chapter.id] = chapter;
		return map;
	}, [chapters]);

	const firstId = order.length > 0 ? order[0] : null;
	const [activeId, setActiveId] = React.useState(initialPageId !== null && pages[initialPageId] !== undefined ? initialPageId : firstId);
	const [search, setSearch] = React.useState('');
	const [copiedKey, setCopiedKey] = React.useState(null);
	const [openChapters, setOpenChapters] = React.useState(() => {
		const initial = initialPageId !== null && pages[initialPageId] !== undefined ? pages[initialPageId] : pages[firstId];
		const state = {};
		if (initial !== undefined && initial !== null) state[initial.chapter] = true;
		else if (chapters.length > 0) state[chapters[0].id] = true;
		return state;
	});

	React.useEffect(() => {
		if (typeof initialPageId !== 'string' || initialPageId === '' || pages[initialPageId] === undefined) return;
		setActiveId(initialPageId);
		const page = pages[initialPageId];
		setOpenChapters((current) => (current[page.chapter] === true ? current : Object.assign({}, current, { [page.chapter]: true })));
	}, [initialPageId]);

	const activePage = activeId === null ? undefined : pages[activeId];
	const activeChapter = activePage === undefined ? undefined : chapterById[activePage.chapter];

	const results = React.useMemo(() => {
		const needle = search.trim();
		if (needle === '') return NEST_EMPTY;
		const scored = [];
		for (const page of Object.values(pages)) {
			const score = nestScorePage(page, needle);
			if (score > 0) scored.push({ page, score });
		}
		scored.sort((left, right) => right.score - left.score);
		return scored.slice(0, 40).map((entry) => entry.page);
	}, [pages, search]);

	const selectPage = (id) => {
		if (pages[id] === undefined) return;
		setActiveId(id);
		const page = pages[id];
		setOpenChapters((current) => (current[page.chapter] === true ? current : Object.assign({}, current, { [page.chapter]: true })));
		setSearch('');
	};

	const toggleChapter = (id) => {
		setOpenChapters((current) => {
			const next = Object.assign({}, current);
			if (next[id] === true) delete next[id];
			else next[id] = true;
			return next;
		});
	};

	const index = activeId === null ? -1 : order.indexOf(activeId);
	const prevId = index > 0 ? order[index - 1] : null;
	const nextId = index >= 0 && index < order.length - 1 ? order[index + 1] : null;

	return h('div', { className: 'nek-view' },
		h('style', { key: 'knowledge-styles' }, NEST_CSS_KNOWLEDGE),
		h(NestKbToc, {
			t,
			kb,
			search,
			results,
			activeId,
			openChapters,
			onToggleChapter: toggleChapter,
			onSelectPage: selectPage,
			onSearch: (value) => setSearch(value),
			pageCount: Object.keys(pages).length
		}),
		h('div', { className: 'nek-content ne-scroll' },
			h('div', { className: 'nek-contentHead' },
				h('div', { className: 'nek-contentHeading' },
					h('span', { className: 'ne-eyebrow' }, t('kb.eyebrow')),
					h('h2', { className: 'ne-sectionTitle' }, t('kb.title')),
					h('p', { className: 'ne-sectionIntro' }, t('kb.intro', { pages: kb !== null && kb.meta !== undefined && kb.meta.counts !== undefined ? kb.meta.counts.pages : Object.keys(pages).length }))),
				h('div', { className: 'nek-contentHeadMeta' },
					h('span', { className: 'nek-headStat' }, h('strong', null, String(Object.keys(pages).length)), h('span', null, t('kb.statPages'))),
					h('span', { className: 'nek-headStat' }, h('strong', null, String(chapters.length)), h('span', null, t('kb.statChapters'))),
					h('span', { className: 'nek-headSource' }, h('span', { className: 'nek-sourceDot', 'aria-hidden': true }), t('kb.headSource')))
			),
			activePage === undefined
				? h('div', { className: 'ne-empty' }, NestGlyph({ name: 'book', size: 26 }), h('p', null, t('kb.empty')))
				: h(NestKbPage, {
					t,
					page: activePage,
					chapter: activeChapter,
					onAskAi,
					onOpenPage,
					copiedKey,
					setCopiedKey
				}),
			h('div', { className: 'nek-pager' },
				prevId === null
					? h('span', null)
					: h('button', { className: 'ne-btn', type: 'button', onClick: () => selectPage(prevId) },
						NestGlyph({ name: 'arrowLeft', size: 12 }), h('span', null, t('kb.prevPage')),
						h('span', { className: 'nek-pagerPage' }, pages[prevId].titleZh === undefined ? prevId : pages[prevId].titleZh)),
				nextId === null
					? h('span', null)
					: h('button', { className: 'ne-btn', type: 'button', onClick: () => selectPage(nextId) },
						h('span', null, t('kb.nextPage')),
						h('span', { className: 'nek-pagerPage' }, pages[nextId].titleZh === undefined ? nextId : pages[nextId].titleZh),
						NestGlyph({ name: 'arrowRight', size: 12 }))
			)
		)
	);
}
// #endregion
