// #region panel
// The NestJS Assistant page: header (brand, workspace selector, knowledge stats),
// four tabs, and the shared data/queue plumbing. Views receive everything they
// render as props; they never fetch or touch plugin state themselves.

/** Tabs, in display order. */
const NEST_TABS = [
	{ id: 'knowledge', glyph: 'book', label: 'tab.knowledge' },
	{ id: 'map', glyph: 'map', label: 'tab.map' },
	{ id: 'route', glyph: 'route', label: 'tab.route' },
	{ id: 'playground', glyph: 'terminal', label: 'tab.playground' }
];

/** Read the persisted tab, falling back to the knowledge tab. */
function nestReadTab() {
	const stored = nestReadStore('tab', null);
	if (stored === 'knowledge' || stored === 'map' || stored === 'route' || stored === 'playground') return stored;
	return 'knowledge';
}

/** The NestJS Assistant page rendered into the shell's `main` slot. */
function NestAssistantPanel(props) {
	const t = props.t;
	const sessionState = props.useSessions((state) => state);
	const workspaceState = props.useWorkspaces((state) => state);
	const sessionsById = sessionState !== null && sessionState !== undefined && sessionState.byId !== undefined ? sessionState.byId : {};
	const workspaces = workspaceState !== null && workspaceState !== undefined && Array.isArray(workspaceState.items) ? workspaceState.items : NEST_EMPTY;

	const [workspaceChoice, setWorkspaceChoice] = React.useState(null);
	let workspace = null;
	if (workspaceChoice !== null) {
		for (const candidate of workspaces) if (candidate.workspaceId === workspaceChoice) workspace = candidate;
	}
	if (workspace === null) workspace = nestResolveWorkspace(workspaces, sessionsById);
	const workspaceId = workspace === null ? null : workspace.workspaceId;

	const [tab, setTab] = React.useState(nestReadTab);
	React.useEffect(() => {
		nestWriteStore('tab', tab);
	}, [tab]);
	React.useEffect(() => {
		if (workspaceId !== null) nestWriteStore('workspace', workspaceId);
	}, [workspaceId]);

	// Cross-tab handoff: the learning route asks the playground to open a module.
	// The route sets it, the playground consumes it once and calls back to clear.
	const [pendingModuleId, setPendingModuleId] = React.useState(null);
	const consumePendingModule = React.useCallback(() => {
		setPendingModuleId(null);
	}, []);

	const [kbState, setKbState] = React.useState({ phase: 'loading', knowledge: null, error: null });
	const [kbToken, setKbToken] = React.useState(0);
	React.useEffect(() => {
		let alive = true;
		setKbState((previous) => (previous.knowledge === null ? { phase: 'loading', knowledge: null, error: null } : Object.assign({}, previous, { phase: 'refreshing' })));
		nestFetchJson('/kb').then((payload) => {
			if (!alive) return;
			const knowledge = payload !== null && payload !== undefined ? payload.knowledge : null;
			if (knowledge === null || typeof knowledge !== 'object') {
				setKbState({ phase: 'error', knowledge: null, error: '返回数据为空' });
				return;
			}
			setKbState({ phase: 'ready', knowledge, error: null });
		}, (error) => {
			if (!alive) return;
			setKbState({ phase: 'error', knowledge: null, error: nestErrorMessage(error) });
		});
		return () => {
			alive = false;
		};
	}, [kbToken]);

	const knowledge = kbState.knowledge;
	const pages = knowledge !== null && knowledge.pages !== undefined ? knowledge.pages : {};
	const pageCount = Object.keys(pages).length;

	const [pageId, setPageId] = React.useState(null);
	const [progress, setProgress] = React.useState(() => {
		const stored = nestReadStore('routeProgress', null);
		return stored !== null && typeof stored === 'object' ? stored : {};
	});
	const toggleRouteItem = React.useCallback((itemId) => {
		setProgress((previous) => {
			const next = Object.assign({}, previous);
			if (next[itemId] === true) delete next[itemId];
			else next[itemId] = true;
			nestWriteStore('routeProgress', next);
			return next;
		});
	}, []);

	const [queuedPrompt, setQueuedPrompt] = React.useState(null);
	const [toast, setToast] = React.useState(null);
	React.useEffect(() => {
		if (toast === null) return undefined;
		const timer = setTimeout(() => setToast(null), 7000);
		return () => clearTimeout(timer);
	}, [toast]);

	const askAi = React.useCallback((text) => {
		if (typeof text !== 'string' || text.trim() === '') return;
		setQueuedPrompt({ id: nestRequestId(), text: text.trim() });
		setTab('playground');
	}, []);
	const onPromptSent = React.useCallback((id) => {
		setQueuedPrompt((current) => (current !== null && current.id === id ? null : current));
	}, []);

	const openPage = React.useCallback((id) => {
		if (typeof id !== 'string' || id === '') return;
		setPageId(id);
		setTab('knowledge');
	}, []);

	// Learning route → playground: remember which module to open, then switch tab.
	// The playground view consumes `initialModuleId` on mount/change.
	const openPlayground = React.useCallback((item) => {
		if (item === null || item === undefined) return;
		if (typeof item.id !== 'string' || item.id === '') return;
		setPendingModuleId(item.id);
		setTab('playground');
	}, []);

	// The knowledge view asks the AI through a shared prompt template so the
	// knowledge base stays a data source, not a second chat implementation.
	const onKnowledgeAsk = React.useCallback((page, mode) => {
		if (page === null || page === undefined) return;
		const title = typeof page.titleZh === 'string' && page.titleZh !== '' ? page.titleZh : page.title;
		if (mode === 'practice') askAi(nestFormat(t('kb.askPracticePrompt'), { title }));
		else askAi(nestFormat(t('kb.askExplainPrompt'), { title }));
	}, [t, askAi]);

	const onMapAsk = React.useCallback((domain) => {
		if (domain === null || domain === undefined) return;
		const title = typeof domain.titleZh === 'string' && domain.titleZh !== '' ? domain.titleZh : domain.title;
		askAi(nestFormat(t('prompt.mapDomain'), { title }));
	}, [t, askAi]);

	const onRouteAsk = React.useCallback((item, mode) => {
		if (item === null || item === undefined) return;
		if (mode === 'learn') askAi(nestFormat(t('prompt.routeLearn'), { title: item.title }));
		else askAi(nestFormat(t('prompt.routePractice'), { title: item.title }));
	}, [t, askAi]);

	const onSelectWorkspace = (event) => {
		const next = event.target.value;
		setWorkspaceChoice(next);
		nestWriteStore('workspace', next);
	};

	let body = null;
	if (tab === 'playground') {
		body = h(NestPlaygroundView, {
			key: 'playground',
			t,
			workspaceId,
			workspaceState,
			queuedPrompt,
			onPromptSent,
			onAskAi: askAi,
			initialModuleId: pendingModuleId,
			onInitialModuleConsumed: consumePendingModule
		});
	} else if (kbState.phase === 'loading') {
		body = h('div', { className: 'ne-loadingLine' }, NestSpinner({}), h('span', null, t('kb.loading')));
	} else if (kbState.phase === 'error') {
		body = h('div', { className: 'ne-errorBox' },
			h('div', null, t('kb.loadFailed') + String(kbState.error === null ? '' : kbState.error)),
			h('button', { className: 'ne-btn', type: 'button', onClick: () => setKbToken((value) => value + 1) }, t('common.retry'))
		);
	} else if (tab === 'map') {
		body = h(NestEnterpriseMapView, {
			key: 'map',
			t,
			map: knowledge.enterpriseMap,
			onAskAi: onMapAsk,
			onOpenPage: openPage
		});
	} else if (tab === 'route') {
		body = h(NestLearningRouteView, {
			key: 'route',
			t,
			route: knowledge.learningRoute,
			progress,
			onToggleItem: toggleRouteItem,
			onAskAi: onRouteAsk,
			onOpenPage: openPage,
			onOpenPlayground: openPlayground
		});
	} else {
		body = h(NestKnowledgeView, {
			key: 'knowledge',
			t,
			kb: knowledge,
			initialPageId: pageId,
			onAskAi: onKnowledgeAsk,
			onOpenPage: openPage
		});
	}

	return h('section', { className: 'ne-page', 'aria-label': t('title') },
		h('style', { key: 'base-styles' }, NEST_CSS_BASE),
		h('header', { className: 'ne-header' },
			h('div', { className: 'ne-brand' },
				h('span', { className: 'ne-brandMark', 'aria-hidden': true }, NestPanelIcon({ size: 20 })),
				h('div', { className: 'ne-brandText' },
					h('h1', { className: 'ne-title' }, t('title')),
					h('p', { className: 'ne-subtitle' }, t('subtitle'))
				)
			),
			h('div', { className: 'ne-headerEnd' },
				workspaces.length > 0
					? h('label', { className: 'ne-wsField' },
						h('span', null, t('workspace.label')),
						h('select', {
							className: 'ne-wsSelect',
							value: workspaceId === null ? '' : workspaceId,
							'aria-label': t('workspace.label'),
							onChange: onSelectWorkspace
						}, workspaces.map((candidate) => h('option', { key: candidate.workspaceId, value: candidate.workspaceId }, nestWorkspaceLabel(candidate)))))
					: null,
				knowledge === null
					? null
					: h('span', { className: 'ne-statChip', title: t('kb.sourceHint') },
						NestGlyph({ name: 'book', size: 12 }),
						h('span', null, t('common.pages', { n: pageCount }))
					)
			)
		),
		h('nav', { className: 'ne-tabs', role: 'tablist', 'aria-label': t('title') },
			NEST_TABS.map((entry) => h('button', {
				key: entry.id,
				className: 'ne-tab',
				type: 'button',
				role: 'tab',
				'aria-selected': tab === entry.id ? 'true' : 'false',
				onClick: () => setTab(entry.id)
			}, NestGlyph({ name: entry.glyph, size: 15 }), h('span', null, t(entry.label))))
		),
		h('div', { className: 'ne-body' }, body),
		toast === null ? null : h('div', { className: 'ne-toast', 'data-tone': toast.tone, role: 'status' }, toast.text)
	);
}

/** Display label of a workspace: stored title, then folder basename, then id. */
function nestWorkspaceLabel(workspace) {
	if (workspace === null || workspace === undefined) return '';
	if (typeof workspace.title === 'string' && workspace.title.trim() !== '') return workspace.title;
	const full = typeof workspace.path === 'string' ? workspace.path.replace(/[/\\]+$/, '') : '';
	const separator = Math.max(full.lastIndexOf('/'), full.lastIndexOf('\\'));
	const base = full.slice(separator + 1);
	return base !== '' ? base : String(workspace.workspaceId);
}

/** Workspace whose sessions were updated most recently (the shell's own rule). */
function nestPickRecentWorkspace(workspaces, sessionsById) {
	let selected = null;
	let selectedTime = -Infinity;
	for (const workspace of workspaces) {
		let latest = -Infinity;
		const sessionIds = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [];
		for (const id of sessionIds) {
			const summary = sessionsById[id];
			if (summary !== undefined && summary !== null && typeof summary.updatedAt === 'number') latest = Math.max(latest, summary.updatedAt);
		}
		if (latest === -Infinity) latest = Date.parse(workspace.createdAt) || 0;
		if (selected === null || latest > selectedTime) {
			selected = workspace.workspaceId;
			selectedTime = latest;
		}
	}
	return selected;
}

/** Resolve the workspace the panel should use: stored choice, else most recent. */
function nestResolveWorkspace(workspaces, sessionsById) {
	const stored = nestReadStore('workspace', null);
	if (typeof stored === 'string' && stored !== '') {
		for (const workspace of workspaces) if (workspace.workspaceId === stored) return workspace;
	}
	const recentId = nestPickRecentWorkspace(workspaces, sessionsById);
	if (recentId !== null) {
		for (const workspace of workspaces) if (workspace.workspaceId === recentId) return workspace;
	}
	return workspaces.length > 0 ? workspaces[0] : null;
}
// #endregion
