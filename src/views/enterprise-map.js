// #region enterprise map view
// Enterprise development map: layers -> capability domains -> practices with a
// maturity level (L1-L4), checklists, anti-patterns and the Nest APIs that
// implement each practice. A selected domain opens a detail column.

const NEST_I18N_ENTERPRISE_MAP = {
	zh: {
		'map.title': '企业级开发知识地图',
		'map.introFallback': '把企业级 NestJS 项目真正需要的能力按层组织：工程基础 → 架构与数据 → 稳定性与可观测 → 平台化交付。',
		'map.domains': '{n} 个能力域',
		'map.layers': '{n} 个层次',
		'map.essential': '为什么需要',
		'map.practices': '最佳实践',
		'map.checklist': '上线检查清单',
		'map.antiPatterns': '常见反模式',
		'map.nestApi': '关键 Nest API',
		'map.askAi': '让 AI 展开讲解',
		'map.openPage': '查看相关文档',
		'map.maturity': '成熟度分级',
		'map.projectTemplate': '推荐项目结构',
		'map.selectHint': '点击任意能力域查看落地实践、检查清单与反模式',
		'map.close': '关闭详情',
		'map.levelLabel': 'L{level}',
		'map.practiceCount': '{n} 条实践',
		'map.checkCount': '{n} 项检查',
		'map.empty': '企业地图数据尚未生成',
		'map.eyebrow': '企业级能力地图'
	},
	en: {
		'map.title': 'Enterprise development map',
		'map.introFallback': 'Capabilities an enterprise NestJS project actually needs, organized by layer: engineering foundation → architecture & data → reliability & observability → platform delivery.',
		'map.domains': '{n} capability domains',
		'map.layers': '{n} layers',
		'map.essential': 'Why it matters',
		'map.practices': 'Best practices',
		'map.checklist': 'Go-live checklist',
		'map.antiPatterns': 'Anti-patterns',
		'map.nestApi': 'Key Nest APIs',
		'map.askAi': 'Ask AI to expand',
		'map.openPage': 'Open related page',
		'map.maturity': 'Maturity levels',
		'map.projectTemplate': 'Recommended project layout',
		'map.selectHint': 'Click a capability domain to see practices, checklist and anti-patterns',
		'map.close': 'Close details',
		'map.levelLabel': 'L{level}',
		'map.practiceCount': '{n} practices',
		'map.checkCount': '{n} checks',
		'map.empty': 'Enterprise map data is not generated yet',
		'map.eyebrow': 'ENTERPRISE CAPABILITY MAP'
	}
};

/** Maturity level chip. */
function NestMapLevel(props) {
	const level = String(props.level === undefined ? 'L1' : props.level).replace(/[^L0-9]/g, '');
	return h('span', { className: 'nem-level', 'data-level': level }, level);
}

/** One capability domain card. */
function NestMapDomainCard(props) {
	const t = props.t;
	const domain = props.domain;
	const selected = props.selected;
	const onSelect = props.onSelect;
	const practices = Array.isArray(domain.practices) ? domain.practices : [];
	const checklist = Array.isArray(domain.checklist) ? domain.checklist : [];
	const nestApi = Array.isArray(domain.nestApi) ? domain.nestApi : [];
	return h('button', {
		className: 'nem-card',
		type: 'button',
		'data-selected': selected ? 'true' : 'false',
		onClick: () => onSelect(domain)
	},
		h('div', { className: 'nem-cardTop' },
			h('h3', { className: 'nem-cardTitle' }, domain.titleZh),
			h('span', { className: 'nem-cardEn' }, domain.title)
		),
		h('p', { className: 'nem-cardEssential' }, nestClipText(domain.essential, 120)),
		h('div', { className: 'nem-cardFooter' },
			h('span', { className: 'ne-chip ne-chipSoft' }, t('map.practiceCount', { n: practices.length })),
			checklist.length > 0 ? h('span', { className: 'ne-chip ne-chipSoft' }, t('map.checkCount', { n: checklist.length })) : null,
			nestApi.length > 0 ? h('span', { className: 'nem-cardApi' }, nestApi.slice(0, 2).join(' · ')) : null
		)
	);
}

/** Detail column for the selected domain. */
function NestMapDetail(props) {
	const t = props.t;
	const domain = props.domain;
	const onClose = props.onClose;
	const onAskAi = props.onAskAi;
	const onOpenPage = props.onOpenPage;
	const practices = Array.isArray(domain.practices) ? domain.practices : [];
	const checklist = Array.isArray(domain.checklist) ? domain.checklist : [];
	const antiPatterns = Array.isArray(domain.antiPatterns) ? domain.antiPatterns : [];
	const nestApi = Array.isArray(domain.nestApi) ? domain.nestApi : [];
	return h('aside', { className: 'nem-detail', 'aria-label': domain.titleZh },
		h('header', { className: 'nem-detailHead' },
			h('div', { className: 'nem-detailTitleWrap' },
				h('h3', { className: 'nem-detailTitle' }, domain.titleZh),
				h('p', { className: 'nem-detailEn' }, domain.title)
			),
			h('button', { className: 'ne-iconBtn', type: 'button', title: t('map.close'), 'aria-label': t('map.close'), onClick: onClose }, NestGlyph({ name: 'plus', size: 14 }))
		),
		h('div', { className: 'nem-detailBody ne-scroll' },
			h('section', { className: 'nem-detailBlock' },
				h('h4', { className: 'nem-detailLabel' }, t('map.essential')),
				h('p', { className: 'nem-detailText' }, domain.essential)
			),
			h('section', { className: 'nem-detailBlock' },
				h('h4', { className: 'nem-detailLabel' }, t('map.practices')),
				h('div', { className: 'nem-practiceList' }, practices.map((practice, index) => h('div', { className: 'nem-practice', key: 'p' + String(index) },
					h('div', { className: 'nem-practiceHead' },
						NestMapLevel({ level: practice.level }),
						h('h5', { className: 'nem-practiceTitle' }, practice.title)
					),
					h('p', { className: 'nem-practiceText' }, practice.detail),
					Array.isArray(practice.pageRefs) && practice.pageRefs.length > 0
						? h('div', { className: 'ne-pillRow nem-refRow' }, practice.pageRefs.map((ref) => h('button', {
							key: ref,
							className: 'ne-btn ne-btnSmall ne-btnGhost',
							type: 'button',
							onClick: () => onOpenPage(ref)
						}, NestGlyph({ name: 'arrowRight', size: 11 }), h('span', null, ref))))
						: null
				)))
			),
			checklist.length > 0
				? h('section', { className: 'nem-detailBlock' },
					h('h4', { className: 'nem-detailLabel' }, t('map.checklist')),
					h('ul', { className: 'nem-checks' }, checklist.map((entry, index) => h('li', { key: 'c' + String(index) },
						NestGlyph({ name: 'check', size: 12 }), h('span', null, entry)))))
				: null,
			antiPatterns.length > 0
				? h('section', { className: 'nem-detailBlock' },
					h('h4', { className: 'nem-detailLabel' }, t('map.antiPatterns')),
					h('ul', { className: 'nem-antis' }, antiPatterns.map((entry, index) => h('li', { key: 'a' + String(index) },
						NestGlyph({ name: 'alert', size: 12 }), h('span', null, entry)))))
				: null,
			nestApi.length > 0
				? h('section', { className: 'nem-detailBlock' },
					h('h4', { className: 'nem-detailLabel' }, t('map.nestApi')),
					h('div', { className: 'ne-pillRow' }, nestApi.map((entry) => h('code', { className: 'nem-apiChip', key: entry }, entry))))
				: null
		),
		h('footer', { className: 'nem-detailFoot' },
			h('button', { className: 'ne-btn ne-btnPrimary', type: 'button', onClick: () => onAskAi(domain) },
				NestGlyph({ name: 'spark', size: 13 }), h('span', null, t('map.askAi')))
		)
	);
}

/** The enterprise development knowledge map view. */
function NestEnterpriseMapView(props) {
	const t = props.t;
	const map = props.map;
	const onAskAi = typeof props.onAskAi === 'function' ? props.onAskAi : function () {};
	const onOpenPage = typeof props.onOpenPage === 'function' ? props.onOpenPage : function () {};
	const [selectedId, setSelectedId] = React.useState(null);

	if (map === null || map === undefined || !Array.isArray(map.domains)) {
		return h('div', { className: 'nem-view' },
			h('style', { key: 'map-styles' }, NEST_CSS_ENTERPRISE_MAP),
			h('div', { className: 'ne-empty' }, NestGlyph({ name: 'map', size: 26 }), h('p', null, t('map.empty')))
		);
	}

	const layers = Array.isArray(map.layers) ? map.layers : NEST_EMPTY;
	const maturity = Array.isArray(map.maturity) ? map.maturity : NEST_EMPTY;
	const domains = Array.isArray(map.domains) ? map.domains : NEST_EMPTY;
	const selected = selectedId === null ? null : domains.find((domain) => domain.id === selectedId) || null;
	const template = map.projectTemplate !== null && typeof map.projectTemplate === 'object' ? map.projectTemplate : null;

	const domainsOfLayer = (layerId) => domains.filter((domain) => domain.layerId === layerId);

	return h('div', { className: 'nem-view' },
		h('style', { key: 'map-styles' }, NEST_CSS_ENTERPRISE_MAP),
		h('div', { className: 'nem-main ne-scroll' },
			h('header', { className: 'nem-head' },
				h('div', { className: 'nem-headText' },
					h('span', { className: 'ne-eyebrow' }, t('map.eyebrow')),
					h('h2', { className: 'ne-sectionTitle' }, map.titleZh === undefined ? t('map.title') : map.titleZh),
					h('p', { className: 'ne-sectionIntro' }, map.intro === undefined ? t('map.introFallback') : map.intro)
				),
				h('div', { className: 'nem-stats' },
					h('span', { className: 'ne-chip ne-chipBrand' }, t('map.domains', { n: domains.length })),
					h('span', { className: 'ne-chip' }, t('map.layers', { n: layers.length }))
				)
			),
			maturity.length > 0
				? h('section', { className: 'nem-maturity' },
					h('h3', { className: 'nem-sectionLabel' }, t('map.maturity')),
					h('div', { className: 'nem-maturityRow' }, maturity.map((step, index) => h('div', { className: 'nem-maturityStep', key: String(step.level) },
						h('div', { className: 'nem-maturityBadge' }, String(step.level)),
						h('div', { className: 'nem-maturityText' },
							h('strong', null, step.titleZh),
							h('span', null, step.description)),
						index < maturity.length - 1 ? h('span', { className: 'nem-maturityArrow' }, '›') : null))))
				: null,
			h('p', { className: 'nem-selectHint' }, t('map.selectHint')),
			layers.map((layer) => {
				const layerDomains = domainsOfLayer(layer.id);
				if (layerDomains.length === 0) return null;
				return h('section', { className: 'nem-layer', key: layer.id },
					h('header', { className: 'nem-layerHead' },
						h('span', { className: 'nem-layerBar', 'aria-hidden': true }),
						h('div', null,
							h('h3', { className: 'nem-layerTitle' }, layer.titleZh),
							h('p', { className: 'nem-layerDesc' }, layer.description))
					),
					h('div', { className: 'nem-grid' }, layerDomains.map((domain) => h(NestMapDomainCard, {
						key: domain.id,
						t,
						domain,
						selected: selected !== null && selected.id === domain.id,
						onSelect: (entry) => setSelectedId((current) => (current === entry.id ? null : entry.id))
					})))
				);
			}),
			template !== null
				? h('section', { className: 'nem-template' },
					h('h3', { className: 'nem-sectionLabel' }, t('map.projectTemplate')),
					h('p', { className: 'nem-templateSummary' }, template.summary),
					h('pre', { className: 'nem-tree' }, (Array.isArray(template.tree) ? template.tree : []).join('\n')))
				: null
		),
		selected === null ? null : h(NestMapDetail, {
			t,
			domain: selected,
			onClose: () => setSelectedId(null),
			onAskAi,
			onOpenPage
		})
	);
}
// #endregion
