// #region learning route view
// Staged learning route: overall progress, optional tracks, a vertical stage
// timeline with checkable items (goal / points / deliverable / acceptance /
// related docs / AI practice) and stage checkpoints.

const NEST_I18N_LEARNING_ROUTE = {
	zh: {
		'route.title': 'NestJS 学习路线',
		'route.introFallback': '从心智模型到企业级落地：每个阶段都有可执行的目标、交付物与验收标准。',
		'route.totalHours': '约 {n} 小时',
		'route.itemsDone': '{done}/{total} 项完成',
		'route.overall': '整体进度',
		'route.track': '学习路线：',
		'route.stageDone': '{done}/{total}',
		'route.goal': '阶段目标',
		'route.itemGoal': '目标',
		'route.points': '关键要点',
		'route.deliverable': '交付物',
		'route.accept': '验收标准',
		'route.level': '成熟度',
		'route.pages': '相关文档',
		'route.askPractice': '去操练场练一练',
		'route.askLearn': '问 AI 讲解',
		'route.openPlaygroundTitle': '在操练场打开对应模块，直接动手实现',
		'route.done': '已完成',
		'route.markDone': '标记完成',
		'route.markUndone': '撤销完成',
		'route.checkpoints': '阶段验收',
		'route.minutes': '{n} 分钟',
		'route.empty': '学习路线数据尚未生成',
		'route.eyebrow': '可执行学习路径',
		'route.trackStages': '{n} 个阶段',
		'route.trackItems': '{n} 项任务',
		'route.trackHours': '约 {n} 小时',
		'route.skippedStages': '已跳过：{names}',
		'route.collapse': '收起',
		'route.expand': '展开',
		'route.stages': '个阶段'
	},
	en: {
		'route.title': 'NestJS learning route',
		'route.introFallback': 'From mental model to enterprise delivery: every stage has executable goals, deliverables and acceptance criteria.',
		'route.totalHours': '~{n} hours',
		'route.itemsDone': '{done}/{total} items done',
		'route.overall': 'Overall progress',
		'route.track': 'Track: ',
		'route.stageDone': '{done}/{total}',
		'route.goal': 'Stage goal',
		'route.itemGoal': 'Goal',
		'route.points': 'Key points',
		'route.deliverable': 'Deliverable',
		'route.accept': 'Acceptance',
		'route.level': 'Level',
		'route.pages': 'Related docs',
		'route.askPractice': 'Practice in playground',
		'route.askLearn': 'Ask AI to explain',
		'route.openPlaygroundTitle': 'Open the matching module in the playground and build it',
		'route.done': 'Done',
		'route.markDone': 'Mark done',
		'route.markUndone': 'Mark undone',
		'route.checkpoints': 'Stage checkpoints',
		'route.minutes': '{n} min',
		'route.empty': 'Learning route data is not generated yet',
		'route.eyebrow': 'STAGED LEARNING PATH',
		'route.trackStages': '{n} stages',
		'route.trackItems': '{n} items',
		'route.trackHours': '~{n} hours',
		'route.skippedStages': 'Skipped: {names}',
		'route.collapse': 'Collapse',
		'route.expand': 'Expand',
		'route.stages': 'stages'
	}
};

/** One checkable route item card. */
function NestRouteItem(props) {
	const t = props.t;
	const item = props.item;
	const done = props.done;
	const onToggleItem = props.onToggleItem;
	const onAskAi = props.onAskAi;
	const onOpenPage = props.onOpenPage;
	const onOpenPlayground = props.onOpenPlayground;
	const points = Array.isArray(item.points) ? item.points : NEST_EMPTY;
	const pageIds = Array.isArray(item.pageIds) ? item.pageIds : NEST_EMPTY;
	// The practice-in-playground jump is optional: tests and embeds that don't
	// wire the prop must keep rendering exactly as before (button hidden).
	const canOpenPlayground = typeof onOpenPlayground === 'function';
	const showFoot = pageIds.length > 0 || typeof item.practice === 'string' || canOpenPlayground;
	return h('article', { className: 'ner-item', 'data-done': done ? 'true' : 'false' },
		h('header', { className: 'ner-itemHead' },
			h('button', {
				className: 'ner-check',
				type: 'button',
				'aria-pressed': done ? 'true' : 'false',
				title: done ? t('route.markUndone') : t('route.markDone'),
				onClick: () => onToggleItem(item.id)
			}, done ? NestGlyph({ name: 'check', size: 12 }) : null),
			h('div', { className: 'ner-itemTitleWrap' },
				h('h4', { className: 'ner-itemTitle' }, item.title),
				typeof item.goal === 'string' ? h('p', { className: 'ner-itemGoal' }, item.goal) : null
			),
			h('div', { className: 'ner-itemMeta' },
				typeof item.level === 'string' ? h('span', { className: 'ner-level' }, item.level) : null,
				typeof item.minutes === 'number' ? h('span', { className: 'ne-chip ne-chipSoft' }, t('route.minutes', { n: item.minutes })) : null)
		),
		points.length > 0
			? h('ul', { className: 'ner-points' }, points.map((point, index) => h('li', { key: 'p' + String(index) }, point)))
			: null,
		h('div', { className: 'ner-facts' },
			typeof item.deliverable === 'string' && item.deliverable !== ''
				? h('p', { className: 'ner-fact' },
					h('span', { className: 'ner-factLabel' }, t('route.deliverable')),
					h('span', { className: 'ner-factText' }, item.deliverable))
				: null,
			typeof item.accept === 'string' && item.accept !== ''
				? h('p', { className: 'ner-fact' },
					h('span', { className: 'ner-factLabel' }, t('route.accept')),
					h('span', { className: 'ner-factText' }, item.accept))
				: null
		),
		showFoot
			? h('div', { className: 'ner-itemFoot' },
				h('div', { className: 'ne-pillRow' }, pageIds.map((id) => h('button', {
					key: id,
					className: 'ne-btn ne-btnSmall ne-btnGhost',
					type: 'button',
					onClick: () => onOpenPage(id)
				}, NestGlyph({ name: 'arrowRight', size: 10 }), h('span', null, id)))),
				h('div', { className: 'ner-itemActions' },
					/* Opens the matching playground module only — it must NOT queue a
					   chat prompt (the user asks the coach manually from the pane). */
					h('button', {
						className: 'ne-btn ne-btnSmall ne-btnPrimary',
						type: 'button',
						title: canOpenPlayground ? t('route.openPlaygroundTitle') : t('route.askPractice'),
						onClick: canOpenPlayground ? () => onOpenPlayground(item) : () => onAskAi(item, 'practice')
					}, NestGlyph({ name: canOpenPlayground ? 'play' : 'terminal', size: 11 }), h('span', null, t('route.askPractice'))),
					h('button', { className: 'ne-btn ne-btnSmall', type: 'button', onClick: () => onAskAi(item, 'learn') },
						NestGlyph({ name: 'spark', size: 11 }), h('span', null, t('route.askLearn')))))
			: null
	);
}

/** One stage block on the timeline. */
function NestRouteStage(props) {
	const t = props.t;
	const stage = props.stage;
	const index = props.index;
	const items = Array.isArray(stage.items) ? stage.items : NEST_EMPTY;
	const progress = props.progress;
	const collapsed = props.collapsed;
	const onToggleCollapse = props.onToggleCollapse;
	let done = 0;
	for (const item of items) if (progress[item.id] === true) done += 1;
	const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
	return h('section', { className: 'ner-stage', key: stage.id },
		h('div', { className: 'ner-stageRail', 'aria-hidden': true },
			h('span', { className: 'ner-stageIndex' }, String(index + 1)),
			h('span', { className: 'ner-stageLine' })
		),
		h('div', { className: 'ner-stageBody' },
			h('header', { className: 'ner-stageHead' },
				h('div', { className: 'ner-stageTitleWrap' },
					h('div', { className: 'ner-stageTitleRow' },
						h('h3', { className: 'ner-stageTitle' }, stage.titleZh === undefined ? stage.title : stage.titleZh),
						typeof stage.weeks === 'string' ? h('span', { className: 'ne-chip ne-chipBrand' }, stage.weeks) : null,
						typeof stage.hours === 'number' ? h('span', { className: 'ne-chip ne-chipSoft' }, t('route.totalHours', { n: stage.hours })) : null
					),
					typeof stage.goal === 'string' ? h('p', { className: 'ner-stageGoal' }, stage.goal) : null
				),
				h('div', { className: 'ner-stageProgress' },
					h('span', { className: 'ner-stageCount' }, t('route.stageDone', { done, total: items.length })),
					h('div', { className: 'ner-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent },
						h('span', { className: 'ner-barFill', style: { width: String(percent) + '%' } })),
					h('button', { className: 'ne-linkBtn', type: 'button', onClick: () => onToggleCollapse(stage.id) }, collapsed ? t('route.expand') : t('route.collapse'))
				)
			),
			collapsed
				? null
				: h('div', { className: 'ner-items' }, items.map((item) => h(NestRouteItem, {
					key: item.id,
					t,
					item,
					done: progress[item.id] === true,
					onToggleItem: props.onToggleItem,
					onAskAi: props.onAskAi,
					onOpenPage: props.onOpenPage,
					onOpenPlayground: props.onOpenPlayground
				})))
		)
	);
}

/** The learning route view. */
function NestLearningRouteView(props) {
	const t = props.t;
	const route = props.route;
	const progress = props.progress !== null && typeof props.progress === 'object' ? props.progress : {};
	const onToggleItem = typeof props.onToggleItem === 'function' ? props.onToggleItem : function () {};
	const onAskAi = typeof props.onAskAi === 'function' ? props.onAskAi : function () {};
	const onOpenPage = typeof props.onOpenPage === 'function' ? props.onOpenPage : function () {};
	const onOpenPlayground = typeof props.onOpenPlayground === 'function' ? props.onOpenPlayground : null;
	const [trackId, setTrackId] = React.useState(null);
	const [collapsed, setCollapsed] = React.useState({});
	const mainRef = React.useRef(null);

	if (route === null || route === undefined || !Array.isArray(route.stages)) {
		return h('div', { className: 'ner-view' },
			h('style', { key: 'route-styles' }, NEST_CSS_LEARNING_ROUTE),
			h('div', { className: 'ne-empty' }, NestGlyph({ name: 'route', size: 26 }), h('p', null, t('route.empty')))
		);
	}

	const stages = route.stages;
	const tracks = Array.isArray(route.tracks) ? route.tracks : NEST_EMPTY;
	const checkpoints = Array.isArray(route.checkpoints) ? route.checkpoints : NEST_EMPTY;
	const activeTrack = trackId === null ? (tracks.length > 0 ? tracks[0] : null) : tracks.find((track) => track.id === trackId) || null;
	const visibleStages = activeTrack === null || !Array.isArray(activeTrack.stageIds) || activeTrack.stageIds.length === 0
		? stages
		: stages.filter((stage) => activeTrack.stageIds.indexOf(stage.id) >= 0);

	let totalItems = 0;
	let doneItems = 0;
	for (const stage of visibleStages) {
		for (const item of (Array.isArray(stage.items) ? stage.items : [])) {
			totalItems += 1;
			if (progress[item.id] === true) doneItems += 1;
		}
	}
	const percent = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);
	const visibleHours = visibleStages.reduce((sum, stage) => sum + (typeof stage.hours === 'number' ? stage.hours : 0), 0);
	const trackStageIds = activeTrack !== null && Array.isArray(activeTrack.stageIds) ? activeTrack.stageIds : [];
	const skippedStages = trackStageIds.length > 0 ? stages.filter((stage) => trackStageIds.indexOf(stage.id) < 0) : [];

	const switchTrack = (nextId) => {
		setTrackId(nextId);
		if (mainRef.current !== null) {
			try {
				mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
			} catch (_error) {
				mainRef.current.scrollTop = 0;
			}
		}
	};

	const toggleCollapse = (stageId) => {
		setCollapsed((current) => {
			const next = Object.assign({}, current);
			if (next[stageId] === true) delete next[stageId];
			else next[stageId] = true;
			return next;
		});
	};

	return h('div', { className: 'ner-view' },
		h('style', { key: 'route-styles' }, NEST_CSS_LEARNING_ROUTE),
		h('div', { className: 'ner-main ne-scroll', ref: mainRef },
			h('header', { className: 'ner-head' },
				h('div', { className: 'ner-headText' },
					h('span', { className: 'ne-eyebrow' }, t('route.eyebrow')),
					h('h2', { className: 'ne-sectionTitle' }, route.titleZh === undefined ? t('route.title') : route.titleZh),
					h('p', { className: 'ne-sectionIntro' }, route.intro === undefined ? t('route.introFallback') : route.intro)
				),
				h('div', { className: 'ner-progressBox' },
					h('div', { className: 'ner-progressRow' },
						h('span', null, t('route.overall')),
						h('span', { className: 'ner-progressValue' }, t('route.itemsDone', { done: doneItems, total: totalItems }))
					),
					h('div', { className: 'ner-bar ner-barBig', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent },
						h('span', { className: 'ner-barFill', style: { width: String(percent) + '%' } })),
					h('div', { className: 'ner-progressMeta' },
						visibleHours > 0 ? h('span', { className: 'ne-chip ne-chipSoft' }, t('route.trackHours', { n: visibleHours })) : null,
						h('span', { className: 'ne-chip ne-chipSoft' }, t('route.trackStages', { n: visibleStages.length })))
				)
			),
			tracks.length > 0
				? h('div', { className: 'ner-tracks' },
					h('span', { className: 'ner-trackLabel' }, t('route.track')),
					tracks.map((track) => h('button', {
						key: track.id,
						className: 'ner-track',
						type: 'button',
						'data-active': activeTrack !== null && activeTrack.id === track.id ? 'true' : 'false',
						title: track.description,
						onClick: () => switchTrack(track.id)
					}, h('span', { className: 'ner-trackName' }, track.titleZh),
						h('span', { className: 'ner-trackCount' }, String(Array.isArray(track.stageIds) ? track.stageIds.length : stages.length)))))
				: null,
			activeTrack !== null
				? h('div', { className: 'ner-trackSummary' },
					h('div', { className: 'ner-trackSummaryText' },
						h('strong', { className: 'ner-trackSummaryTitle' }, activeTrack.titleZh),
						typeof activeTrack.description === 'string' && activeTrack.description !== ''
							? h('p', { className: 'ner-trackSummaryDesc' }, activeTrack.description)
							: null,
						skippedStages.length > 0
							? h('p', { className: 'ner-trackSkipped' }, t('route.skippedStages', { names: skippedStages.map((stage) => stage.titleZh === undefined ? stage.title : stage.titleZh).join('、') }))
							: null),
					h('div', { className: 'ner-trackStats' },
						h('span', { className: 'ne-chip ne-chipBrand' }, t('route.trackStages', { n: visibleStages.length })),
						h('span', { className: 'ne-chip ne-chipSoft' }, t('route.trackItems', { n: totalItems })),
						visibleHours > 0 ? h('span', { className: 'ne-chip ne-chipSoft' }, t('route.trackHours', { n: visibleHours })) : null))
				: null,
			h('div', { className: 'ner-timeline' }, visibleStages.map((stage, index) => h(NestRouteStage, {
				key: stage.id,
				t,
				stage,
				index,
				progress,
				collapsed: collapsed[stage.id] === true,
				onToggleCollapse: toggleCollapse,
				onToggleItem,
				onAskAi,
				onOpenPage,
				onOpenPlayground
			}))),
			checkpoints.length > 0
				? h('section', { className: 'ner-checkpoints' },
					h('h3', { className: 'ner-checkpointsTitle' }, NestGlyph({ name: 'check', size: 14 }), h('span', null, t('route.checkpoints'))),
					h('div', { className: 'ner-checkpointGrid' }, checkpoints.map((checkpoint, index) => h('div', { className: 'ner-checkpoint', key: 'cp' + String(index) },
						h('span', { className: 'ner-checkpointIndex' }, '✓'),
						h('div', null,
							h('strong', null, checkpoint.title),
							h('p', null, checkpoint.description)))))
				)
				: null
		)
	);
}
// #endregion
