// #region registration
// Activation of the browser half: merge dictionaries, register the central
// `main` panel and its sidebar entry under one shared id (the sidebar row
// selects the `main` cell by this exact id).

/** Dictionary namespace owned by this plugin. */
const NEST_NS = 'nestAssistant';

/** Central panel id shared by the `main` entry and the sidebar entry. */
const NEST_PANEL_ID = 'nest-assistant';

/** Client services the panel reads. */
const inject = ['slots', 'locale', 'remote', 'remote.session', 'uiWorkspace'];

/** Merge every dictionary fragment contributed by the view files into one map. */
function nestMergeDictionaries(localeKey) {
	const merged = {};
	const base = localeKey === 'zh' ? NEST_ZH_BASE : NEST_EN_BASE;
	for (const [key, value] of Object.entries(base)) merged[key] = value;
	const fragments = [NEST_I18N_KNOWLEDGE, NEST_I18N_ENTERPRISE_MAP, NEST_I18N_LEARNING_ROUTE];
	for (const fragment of fragments) {
		if (fragment === null || typeof fragment !== 'object') continue;
		const part = fragment[localeKey];
		if (part === null || typeof part !== 'object') continue;
		for (const [key, value] of Object.entries(part)) merged[key] = value;
	}
	return merged;
}

/** Sidebar list mark; the sidebar renders the label and accessible name itself. */
function NestSidebarIcon(props) {
	return NestPanelIcon({ size: props !== null && props !== undefined && typeof props.size === 'number' ? props.size : 16 });
}

/**
 * Register the plugin UI.
 * @param ctx - Client root context.
 */
function apply(ctx) {
	nestClientContext = ctx;
	const zh = nestMergeDictionaries('zh');
	const en = nestMergeDictionaries('en');
	ctx.effect(() => ctx.locale.register(NEST_NS, { zh, en }), 'nest-assistant: dictionaries');
	const t = ctx.locale.bind(NEST_NS);
	ctx.slots.inject('main', () => ctx.slots.register({
		name: 'main',
		key: NEST_PANEL_ID,
		locale: NEST_NS
	}, NestAssistantPanel));
	ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
		name: 'sidebar.panellist',
		id: NEST_PANEL_ID,
		order: 7,
		label: () => t('title'),
		locale: NEST_NS
	}, NestSidebarIcon));
}
// #endregion
