// #region playground view
// Two panes: the AI coach chat on the left, the editable NestJS sandbox on the
// right (file list, editor, Run/Stop, request console and logs). All runtime
// work goes through the Host API under /nest-assistant/api/playground/*; the
// sandbox files are real files on disk, so the user can also inspect them from
// the shell.

/** Preferred first file to open. */
const NEST_PG_DEFAULT_FILE = 'src/app.module.ts';

/** Indentation step (px) for one level of the sandbox file tree. */
const NEST_PG_TREE_INDENT = 11;

/** Normalize one relative path: forward slashes, no leading/trailing slash. */
function nestPgNormalizePath(value) {
	return String(value === undefined || value === null ? '' : value)
		.replace(/\\/g, '/')
		.replace(/^\.?\//, '')
		.replace(/\/+/g, '/')
		.replace(/\/+$/, '');
}

/** Parent directory of one relative path ('' for the project root). */
function nestPgDirOf(relPath) {
	const normalized = nestPgNormalizePath(relPath);
	const slash = normalized.lastIndexOf('/');
	return slash < 0 ? '' : normalized.slice(0, slash);
}

/** Relative path of one file/dir entry from the Host listing (string or `{ path }`). */
function nestPgPathOf(entry) {
	if (typeof entry === 'string') return nestPgNormalizePath(entry);
	if (entry === null || typeof entry !== 'object') return '';
	return typeof entry.path === 'string' ? nestPgNormalizePath(entry.path) : '';
}

/** Root-level files that must never be deleted from the sandbox tree. */
const NEST_PG_ROOT_FILE_NAMES = ['package.json', 'tsconfig.json', 'package-lock.json', 'nest-cli.json', '.gitignore', '.npmrc'];

/**
 * True when the delete button may remove `selection`. Only entries below `src/`
 * are deletable; the `src` directory itself, `build`/`runner.cjs` and the root
 * config files are always protected.
 */
function nestPgDeletable(selection) {
	if (selection === null || typeof selection !== 'object') return false;
	const path = nestPgNormalizePath(selection.path);
	if (path === '') return false;
	if (path === 'src' || path === 'build' || path === 'node_modules' || path === 'runner.cjs') return false;
	if (NEST_PG_ROOT_FILE_NAMES.indexOf(path) >= 0) return false;
	return (path + '/').startsWith('src/');
}

/**
 * Preferred file to open: the module `defaultFile` when it exists, else the
 * first TypeScript file, else the first file. Shared by boot/reset/module
 * switch/deletion so the editor never falls back to a root config file.
 */
function nestPgPreferredFile(list, defaultFile) {
	const files = (Array.isArray(list) ? list : NEST_EMPTY).filter((file) => file !== null && typeof file === 'object' && typeof file.path === 'string');
	if (files.length === 0) return null;
	const wanted = typeof defaultFile === 'string' && defaultFile.trim() !== '' ? nestPgNormalizePath(defaultFile) : NEST_PG_DEFAULT_FILE;
	const exact = files.find((file) => nestPgNormalizePath(file.path) === wanted);
	if (exact !== undefined) return exact;
	const script = files.find((file) => /\.tsx?$/i.test(String(file.path)));
	if (script !== undefined) return script;
	return files[0];
}

/**
 * Validate one create-form entry path. Returns `{ error: 'pg.key' }` or
 * `{ value: normalizedPath }`. Rejects absolute paths and, for files, a
 * trailing slash; trims the input and refuses to submit the parent folder.
 */
function nestPgValidateEntry(rawValue, kind, parent) {
	const raw = String(rawValue === undefined || rawValue === null ? '' : rawValue).trim();
	if (raw === '') return { error: 'pg.nameRequired' };
	if (/^[\\/]/.test(raw) || /^[A-Za-z]:[\\/]/.test(raw)) return { error: 'pg.absolutePath' };
	if (kind !== 'dir' && /[\\/]$/.test(raw)) return { error: 'pg.invalidName' };
	const normalized = nestPgNormalizePath(raw);
	if (normalized === '' || normalized === nestPgNormalizePath(parent)) return { error: 'pg.nameRequired' };
	const segments = normalized.split('/');
	if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return { error: 'pg.invalidName' };
	if (!(normalized + '/').startsWith('src/')) return { error: 'pg.srcOnly' };
	return { value: normalized };
}

/** Sort modules by stage then item (`sandbox` carries stageIndex 0). */
function nestPgSortModules(modules) {
	const list = (Array.isArray(modules) ? modules : NEST_EMPTY)
		.filter((module) => module !== null && typeof module === 'object' && typeof module.id === 'string')
		.slice();
	return list.sort((left, right) => {
		const leftStage = typeof left.stageIndex === 'number' ? left.stageIndex : 0;
		const rightStage = typeof right.stageIndex === 'number' ? right.stageIndex : 0;
		if (leftStage !== rightStage) return leftStage - rightStage;
		const leftItem = typeof left.itemIndex === 'number' ? left.itemIndex : 0;
		const rightItem = typeof right.itemIndex === 'number' ? right.itemIndex : 0;
		return leftItem - rightItem;
	});
}

/** `[{ key, titleZh, modules }]` in stage order, used for the module optgroups. */
function nestPgModuleGroups(modules, fallbackTitle) {
	const groups = [];
	for (const module of nestPgSortModules(modules)) {
		const key = typeof module.stageId === 'string' && module.stageId !== '' ? module.stageId : 'stage-' + String(groups.length);
		let group = groups.find((entry) => entry.key === key);
		if (group === undefined) {
			const title = typeof module.stageTitleZh === 'string' && module.stageTitleZh !== '' ? module.stageTitleZh : fallbackTitle;
			group = { key, titleZh: title, modules: [] };
			groups.push(group);
		}
		group.modules.push(module);
	}
	return groups;
}

/** Text of one module option: `itemIndex. titleZh` (sandbox gets its own label). */
function nestPgModuleLabel(module, sandboxLabel) {
	if (module.id === 'sandbox') return sandboxLabel;
	const title = typeof module.titleZh === 'string' && module.titleZh !== '' ? module.titleZh : typeof module.title === 'string' && module.title !== '' ? module.title : module.id;
	if (typeof module.itemIndex === 'number') return String(module.itemIndex) + '. ' + title;
	return title;
}

/** Find one module summary by id (null when absent). */
function nestPgFindModule(modules, moduleId) {
	if (typeof moduleId !== 'string' || moduleId === '') return null;
	const list = Array.isArray(modules) ? modules : NEST_EMPTY;
	const found = list.find((module) => module !== null && typeof module === 'object' && module.id === moduleId);
	return found === undefined ? null : found;
}

/**
 * Next free snapshot name for a module: `我的实现` → `我的实现 2` → …
 * (the Host rejects duplicate names per module).
 */
function nestPgNextSnapshotName(snapshots, preferred) {
	const base = typeof preferred === 'string' && preferred.trim() !== '' ? preferred.trim() : '我的实现';
	const names = (Array.isArray(snapshots) ? snapshots : NEST_EMPTY).map((snapshot) =>
		snapshot !== null && typeof snapshot === 'object' && typeof snapshot.name === 'string' ? snapshot.name.trim() : ''
	);
	if (names.indexOf(base) < 0) return base;
	for (let index = 2; index < 500; index += 1) {
		const candidate = base + ' ' + String(index);
		if (names.indexOf(candidate) < 0) return candidate;
	}
	return base + ' ' + String(Date.now());
}

/** Select value of the currently used version (`default` or a snapshot id). */
function nestPgVersionValue(active) {
	if (active === null || typeof active !== 'object' || active.version === null || typeof active.version !== 'object') return 'default';
	return active.version.kind === 'snapshot' && typeof active.version.snapshotId === 'string' ? active.version.snapshotId : 'default';
}

/**
 * Build the sandbox tree from the flat host listing. `dirs` carries the
 * directories (including empty ones) so a freshly created folder shows up
 * before it contains anything; intermediate parents are synthesized.
 */
function nestPgBuildTree(files, dirs) {
	const root = { path: '', name: '', kind: 'dir', children: [] };
	const byPath = { '': root };
	const ensureDir = (dirPath) => {
		if (Object.prototype.hasOwnProperty.call(byPath, dirPath)) return byPath[dirPath];
		const parent = ensureDir(nestPgDirOf(dirPath));
		const node = { path: dirPath, name: dirPath.slice(dirPath.lastIndexOf('/') + 1), kind: 'dir', children: [] };
		byPath[dirPath] = node;
		parent.children.push(node);
		return node;
	};
	for (const dir of Array.isArray(dirs) ? dirs : NEST_EMPTY) {
		const dirPath = typeof dir === 'string' ? dir : dir !== null && typeof dir === 'object' ? dir.path : null;
		if (typeof dirPath !== 'string') continue;
		const normalized = nestPgNormalizePath(dirPath);
		if (normalized !== '') ensureDir(normalized);
	}
	for (const file of Array.isArray(files) ? files : NEST_EMPTY) {
		if (file === null || typeof file !== 'object' || typeof file.path !== 'string') continue;
		const filePath = nestPgNormalizePath(file.path);
		if (filePath === '') continue;
		const parent = ensureDir(nestPgDirOf(filePath));
		parent.children.push({ path: filePath, name: filePath.slice(filePath.lastIndexOf('/') + 1), kind: 'file', size: file.size });
	}
	const sortChildren = (node) => {
		node.children.sort((left, right) => {
			if (left.kind !== right.kind) return left.kind === 'dir' ? -1 : 1;
			return left.name.localeCompare(right.name);
		});
		for (const child of node.children) {
			if (child.kind === 'dir') sortChildren(child);
		}
	};
	sortChildren(root);
	return root;
}

/** Flatten the tree into render rows, skipping the children of collapsed folders. */
function nestPgFlattenTree(node, depth, collapsed, rows) {
	for (const child of node.children) {
		rows.push({ node: child, depth });
		if (child.kind === 'dir' && collapsed[child.path] !== true) nestPgFlattenTree(child, depth + 1, collapsed, rows);
	}
	return rows;
}

/** Remove every collapsed ancestor of `targetPath` so the entry becomes visible. */
function nestPgExpanded(collapsed, targetPath) {
	const next = Object.assign({}, collapsed);
	let changed = false;
	let parent = nestPgDirOf(targetPath);
	while (parent !== '') {
		if (next[parent] === true) {
			delete next[parent];
			changed = true;
		}
		parent = nestPgDirOf(parent);
	}
	return changed ? next : collapsed;
}

/** Build the request form defaults for one route descriptor. */
function nestPgRequestFor(route) {
	return { method: route.method, path: route.path, body: route.method === 'GET' ? '' : '{}' };
}

/** Tokenize one TypeScript line into highlighted spans (best-effort, display only). */
function nestPgHighlightLine(line, keyPrefix) {
	if (line === '') return [h('span', { key: keyPrefix + '-empty' }, ' ')];
	const tokens = [];
	const pattern = /(\/\*.*?\*\/)|(\/\/.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(@[A-Za-z_$][\w$]*)|(\b(?:import|from|export|default|class|extends|implements|interface|type|enum|const|let|var|function|return|new|async|await|if|else|for|of|in|while|switch|case|break|continue|try|catch|finally|throw|public|private|protected|readonly|static|abstract|get|set|constructor|this|super|void|string|number|boolean|any|unknown|never|true|false|null|undefined|as|declare|namespace|module|satisfies|keyof|infer|readonly)\b)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Z][A-Za-z0-9_$]*)/g;
	let cursor = 0;
	let match = pattern.exec(line);
	let index = 0;
	while (match !== null) {
		if (match.index > cursor) tokens.push(h('span', { key: keyPrefix + '-p' + String(index) }, line.slice(cursor, match.index)));
		const token = match[0];
		let className = 'nep-tok';
		if (match[1] !== undefined) className = 'nep-tokComment';
		else if (match[2] !== undefined) className = 'nep-tokComment';
		else if (match[3] !== undefined) className = 'nep-tokString';
		else if (match[4] !== undefined) className = 'nep-tokDecorator';
		else if (match[5] !== undefined) className = 'nep-tokKeyword';
		else if (match[6] !== undefined) className = 'nep-tokNumber';
		else if (match[7] !== undefined) className = 'nep-tokFn';
		else if (match[8] !== undefined) className = 'nep-tokType';
		tokens.push(h('span', { key: keyPrefix + '-t' + String(index), className }, token));
		index += 1;
		cursor = pattern.lastIndex;
		match = pattern.exec(line);
	}
	if (cursor < line.length) tokens.push(h('span', { key: keyPrefix + '-tail' }, line.slice(cursor)));
	return tokens;
}

/** The code editor: gutter + highlighted overlay behind a transparent textarea. */
function NestPgEditor(props) {
	const value = props.value;
	const onChange = props.onChange;
	const textareaRef = React.useRef(null);
	const overlayRef = React.useRef(null);
	const gutterRef = React.useRef(null);
	const lines = React.useMemo(() => String(value === undefined ? '' : value).split('\n'), [value]);
	const highlighted = React.useMemo(() => lines.map((line, index) => h('span', { key: 'l' + String(index), className: 'nep-codeLine' }, nestPgHighlightLine(line, 'h' + String(index)))), [lines]);

	const syncScroll = () => {
		const area = textareaRef.current;
		if (area === null) return;
		if (overlayRef.current !== null) {
			overlayRef.current.scrollTop = area.scrollTop;
			overlayRef.current.scrollLeft = area.scrollLeft;
		}
		if (gutterRef.current !== null) gutterRef.current.scrollTop = area.scrollTop;
	};

	const onKeyDown = (event) => {
		if (event.key !== 'Tab') return;
		event.preventDefault();
		const area = textareaRef.current;
		if (area === null) return;
		const start = area.selectionStart;
		const end = area.selectionEnd;
		const next = value.slice(0, start) + '  ' + value.slice(end);
		onChange(next);
		requestAnimationFrame(() => {
			const node = textareaRef.current;
			if (node === null) return;
			node.selectionStart = start + 2;
			node.selectionEnd = start + 2;
		});
	};

	return h('div', { className: 'nep-editor' },
		h('div', { className: 'nep-gutter', ref: gutterRef, 'aria-hidden': true },
			lines.map((line, index) => h('div', { key: 'g' + String(index), className: 'nep-gutterLine' }, String(index + 1)))
		),
		h('div', { className: 'nep-codeWrap' },
			h('pre', { className: 'nep-overlay', ref: overlayRef, 'aria-hidden': true }, highlighted),
			h('textarea', {
				className: 'nep-textarea',
				ref: textareaRef,
				value,
				spellCheck: false,
				autoCapitalize: 'off',
				autoCorrect: 'off',
				wrap: 'off',
				'aria-label': props.label,
				onChange: (event) => onChange(event.target.value),
				onScroll: syncScroll,
				onKeyDown
			})
		)
	);
}

/** HTTP status tone for one result. */
function nestPgTone(status) {
	if (typeof status !== 'number' || status === 0) return 'error';
	if (status >= 200 && status < 400) return 'success';
	if (status >= 400 && status < 500) return 'warn';
	return 'error';
}

/** One request result card. */
function NestPgResult(props) {
	const t = props.t;
	const result = props.result;
	const tone = nestPgTone(result.status);
	return h('article', { className: 'nep-result', 'data-tone': tone },
		h('header', { className: 'nep-resultHead' },
			h('span', { className: 'nep-method' }, result.method),
			h('code', { className: 'nep-resultPath' }, result.path),
			h('span', { className: 'nep-resultStatus' }, result.status === 0 ? t('pg.error') : String(result.status)),
			h('span', { className: 'nep-resultTime' }, result.timeMs === undefined ? '' : String(result.timeMs) + ' ms')
		),
		result.error !== undefined
			? h('p', { className: 'nep-resultError' }, result.error)
			: h('pre', { className: 'nep-resultBody' }, String(result.body === undefined ? '' : result.body).slice(0, 20000))
	);
}

/**
 * The sandbox file tree: folders collapse/expand, files open in the editor.
 * The twisty only toggles the folder; the folder label only selects it, so a
 * click never silently changes the deletion target.
 */
function NestPgFileTree(props) {
	const t = props.t;
	const files = Array.isArray(props.files) ? props.files : NEST_EMPTY;
	const dirs = Array.isArray(props.dirs) ? props.dirs : NEST_EMPTY;
	const loading = props.loading === true;
	const collapsed = props.collapsed === null || props.collapsed === undefined ? {} : props.collapsed;
	const selection = props.selection === undefined ? null : props.selection;
	const activePath = props.activePath === undefined ? null : props.activePath;
	const tree = React.useMemo(() => nestPgBuildTree(files, dirs), [files, dirs]);
	const rows = React.useMemo(() => nestPgFlattenTree(tree, 0, collapsed, []), [tree, collapsed]);
	if (files.length === 0 && dirs.length === 0) {
		return h('div', { className: 'nep-fileList ne-scroll' }, h('p', { className: 'ne-muted nep-filesEmpty' }, loading ? t('pg.loadingFiles') : t('pg.noFiles')));
	}
	if (rows.length === 0) return h('div', { className: 'nep-fileList ne-scroll' }, h('p', { className: 'ne-muted nep-filesEmpty' }, t('pg.noFiles')));
	return h('div', { className: 'nep-fileList ne-scroll' }, rows.map((row) => {
		const node = row.node;
		const padding = { paddingLeft: String(4 + row.depth * NEST_PG_TREE_INDENT) + 'px' };
		if (node.kind === 'dir') {
			const isCollapsed = collapsed[node.path] === true;
			const selected = selection !== null && selection.kind === 'dir' && selection.path === node.path;
			const hasChildren = Array.isArray(node.children) && node.children.length > 0;
			return h('div', {
				key: 'dir:' + node.path,
				className: 'nep-treeRow nep-treeDir',
				style: padding,
				'data-selected': selected ? 'true' : 'false',
				'data-collapsed': isCollapsed ? 'true' : 'false',
				title: node.path
			},
				hasChildren
					? h('button', {
						className: 'nep-twistyBtn',
						type: 'button',
						'aria-label': isCollapsed ? t('common.expand') : t('common.collapse'),
						'aria-expanded': isCollapsed ? 'false' : 'true',
						onClick: () => props.onToggleDir(node.path)
					}, NestGlyph({ name: isCollapsed ? 'chevron' : 'chevronDown', size: 10 }))
					: h('span', { className: 'nep-twistyBtn nep-twistyEmpty', 'aria-hidden': true }),
				h('button', {
					className: 'nep-dirLabel',
					type: 'button',
					onClick: () => (typeof props.onSelectDir === 'function' ? props.onSelectDir(node.path) : props.onToggleDir(node.path))
				},
					NestGlyph({ name: 'folder', size: 12 }),
					h('span', { className: 'nep-treeName' }, node.name)
				)
			);
		}
		return h('button', {
			key: 'file:' + node.path,
			className: 'nep-fileRow',
			type: 'button',
			style: padding,
			'data-active': node.path === activePath ? 'true' : 'false',
			title: node.path,
			onClick: () => props.onSelectFile(node.path)
		}, NestGlyph({ name: /\.json$/i.test(node.path) ? 'file' : 'code', size: 12 }), h('span', { className: 'nep-treeName' }, node.name));
	}));
}

/** Inline form that creates one file or folder in the sandbox tree. */
function NestPgCreateBar(props) {
	const t = props.t;
	const kind = props.kind === 'dir' ? 'dir' : 'file';
	const disabled = props.disabled === true;
	return h('form', { className: 'nep-createBar', onSubmit: props.onSubmit },
		h('div', { className: 'nep-createHead' },
			NestGlyph({ name: kind === 'dir' ? 'folderPlus' : 'plus', size: 12 }),
			h('span', null, kind === 'dir' ? t('pg.newFolder') : t('pg.newFile'))
		),
		h('div', { className: 'nep-createRow' },
			h('input', {
				className: 'ne-input nep-createInput',
				value: props.value,
				placeholder: kind === 'dir' ? t('pg.newFolderPlaceholder') : t('pg.newFilePlaceholder'),
				'aria-label': t('pg.entryPath'),
				autoFocus: true,
				spellCheck: false,
				disabled,
				onChange: (event) => props.onChange(event.target.value),
				onKeyDown: (event) => {
					if (event.key === 'Escape') {
						event.preventDefault();
						props.onCancel();
					}
				}
			}),
			h('button', { className: 'ne-iconBtn', type: 'submit', title: t('pg.createConfirm'), 'aria-label': t('pg.createConfirm'), disabled }, NestGlyph({ name: 'check', size: 13 }))
		),
		h('p', { className: 'nep-createHint' }, t('pg.createHint'))
	);
}

/**
 * Module bar under the right-hand toolbar (`.nep-mod-*` classes): code module
 * selector grouped by learning stage, code version selector, snapshot actions,
 * dirty indicator and the current module summary.
 */
function NestPgModuleBar(props) {
	const t = props.t;
	const state = props.state === null || typeof props.state !== 'object' ? {} : props.state;
	const phase = state.phase === 'ready' ? 'ready' : state.phase === 'error' ? 'error' : 'loading';
	const modules = Array.isArray(state.modules) ? state.modules : NEST_EMPTY;
	const active = state.active === null || typeof state.active !== 'object' ? null : state.active;
	const busy = props.busy === true;
	const onSwitchModule = typeof props.onSwitchModule === 'function' ? props.onSwitchModule : null;
	const onLoadVersion = typeof props.onLoadVersion === 'function' ? props.onLoadVersion : null;
	const onSaveSnapshot = typeof props.onSaveSnapshot === 'function' ? props.onSaveSnapshot : null;
	const onResetDefault = typeof props.onResetDefault === 'function' ? props.onResetDefault : null;
	const onDeleteSnapshot = typeof props.onDeleteSnapshot === 'function' ? props.onDeleteSnapshot : null;
	const snapshotForm = props.snapshotForm === null || typeof props.snapshotForm !== 'object' ? null : props.snapshotForm;
	const formOpen = snapshotForm !== null;
	const locked = busy || formOpen;

	if (phase !== 'ready' || active === null) {
		const message = phase === 'loading' ? t('pg.moduleLoading') : phase === 'error' ? t('pg.moduleUnavailable') : modules.length === 0 ? t('pg.noModules') : t('pg.moduleUnavailable');
		const hint = phase === 'error' ? t('pg.moduleErrorHint') : t('pg.moduleHint');
		const onRetry = typeof props.onRetry === 'function' ? props.onRetry : null;
		return h('div', { className: 'nep-modBar', 'data-phase': phase },
			h('div', { className: 'nep-modRow' },
				h('span', { className: 'nep-modLabel' }, t('pg.module')),
				h('span', { className: 'ne-muted nep-modEmpty', title: hint }, message),
				onRetry === null || phase !== 'error'
					? null
					: h('button', { className: 'ne-btn ne-btnSmall ne-btnGhost nep-modRetry', type: 'button', onClick: () => onRetry() },
						NestGlyph({ name: 'refresh', size: 12 }), h('span', null, t('common.retry')))
			),
			phase === 'error' ? h('div', { className: 'nep-modMeta' }, h('span', { className: 'nep-modSummary', title: hint }, hint)) : null
		);
	}

	const current = nestPgFindModule(modules, active.moduleId);
	const snapshots = current !== null && Array.isArray(current.snapshots)
		? current.snapshots.filter((snapshot) => snapshot !== null && typeof snapshot === 'object' && typeof snapshot.id === 'string')
		: NEST_EMPTY;
	const version = active.version === null || typeof active.version !== 'object' ? { kind: 'default' } : active.version;
	const versionValue = nestPgVersionValue(active);
	const snapshotMissing = version.kind === 'snapshot' && typeof version.snapshotId === 'string' && !snapshots.some((snapshot) => snapshot.id === version.snapshotId);
	const summary = current !== null && typeof current.summary === 'string' && current.summary.trim() !== '' ? current.summary.trim() : '';
	const groups = nestPgModuleGroups(modules, t('pg.moduleOtherStage'));
	const sandboxLabel = t('pg.sandboxModule');
	const dirty = active.dirty === true;
	const fromRoute = props.fromRoute === true;

	return h('div', { className: 'nep-modBar', 'data-phase': 'ready' },
		h('div', { className: 'nep-modRow' },
			h('label', { className: 'nep-modField' },
				h('span', { className: 'nep-modLabel' }, t('pg.module')),
				h('select', {
					className: 'ne-select nep-modSelect',
					value: active.moduleId,
					disabled: locked || onSwitchModule === null,
					'aria-label': t('pg.module'),
					title: t('pg.moduleHint'),
					onChange: (event) => {
						if (onSwitchModule !== null) onSwitchModule(event.target.value);
					}
				},
					groups.map((group) => h('optgroup', { key: 'stage:' + group.key, label: group.titleZh },
						group.modules.map((module) => h('option', { key: module.id, value: module.id }, nestPgModuleLabel(module, sandboxLabel)))))
				)
			),
			h('label', { className: 'nep-modField' },
				h('span', { className: 'nep-modLabel' }, t('pg.version')),
				h('select', {
					className: 'ne-select nep-modSelect nep-modVersion',
					value: versionValue,
					disabled: locked || onLoadVersion === null,
					'aria-label': t('pg.version'),
					onChange: (event) => {
						if (onLoadVersion !== null) onLoadVersion(event.target.value);
					}
				},
					h('option', { key: 'default', value: 'default' }, t('pg.versionDefault')),
					snapshotMissing ? h('option', { key: 'current', value: version.snapshotId }, String(typeof version.name === 'string' && version.name !== '' ? version.name : version.snapshotId)) : null,
					snapshots.map((snapshot) => h('option', { key: snapshot.id, value: snapshot.id }, String(typeof snapshot.name === 'string' && snapshot.name !== '' ? snapshot.name : snapshot.id)))
				)
			),
			h('div', { className: 'nep-modActions' },
				h('button', {
					className: 'ne-btn ne-btnSmall',
					type: 'button',
					disabled: locked || onSaveSnapshot === null,
					title: t('pg.saveSnapshot'),
					onClick: () => {
						if (onSaveSnapshot !== null) onSaveSnapshot();
					}
				}, NestGlyph({ name: 'save', size: 12 }), h('span', null, t('pg.saveSnapshot'))),
				h('button', {
					className: 'ne-btn ne-btnSmall ne-btnGhost',
					type: 'button',
					disabled: locked || onResetDefault === null,
					title: t('pg.resetToDefault'),
					onClick: () => {
						if (onResetDefault !== null) onResetDefault();
					}
				}, NestGlyph({ name: 'refresh', size: 12 }), h('span', null, t('pg.resetToDefault'))),
				h('button', {
					className: 'ne-btn ne-btnSmall ne-btnGhost',
					type: 'button',
					disabled: locked || version.kind !== 'snapshot' || onDeleteSnapshot === null,
					title: t('pg.deleteSnapshot'),
					onClick: () => {
						if (onDeleteSnapshot !== null) onDeleteSnapshot();
					}
				}, NestGlyph({ name: 'trash', size: 12 }), h('span', null, t('pg.deleteSnapshot')))
			)
		),
		formOpen
			? h('form', { className: 'nep-modForm', onSubmit: props.onSnapshotSubmit },
				h('span', { className: 'nep-modLabel' }, t('pg.saveSnapshot')),
				h('input', {
					className: 'ne-input nep-modInput',
					value: snapshotForm.value === undefined || snapshotForm.value === null ? '' : snapshotForm.value,
					placeholder: t('pg.snapshotNamePlaceholder'),
					'aria-label': t('pg.saveSnapshot'),
					autoFocus: true,
					spellCheck: false,
					disabled: snapshotForm.busy === true,
					onChange: (event) => { if (typeof props.onSnapshotChange === 'function') props.onSnapshotChange(event.target.value); },
					onKeyDown: (event) => {
						if (event.key === 'Escape') {
							event.preventDefault();
							if (typeof props.onSnapshotCancel === 'function') props.onSnapshotCancel();
						}
					}
				}),
				h('button', { className: 'ne-btn ne-btnSmall ne-btnPrimary', type: 'submit', disabled: snapshotForm.busy === true },
					snapshotForm.busy === true ? t('pg.saving') : t('pg.snapshotConfirm')),
				h('button', {
					className: 'ne-btn ne-btnSmall ne-btnGhost',
					type: 'button',
					disabled: snapshotForm.busy === true,
					onClick: () => { if (typeof props.onSnapshotCancel === 'function') props.onSnapshotCancel(); }
				}, t('pg.snapshotCancel')),
				h('span', { className: 'ne-muted nep-modHint' }, t('pg.snapshotHint'))
			)
			: null,
		h('div', { className: 'nep-modMeta' },
			h('span', { className: 'nep-modState', 'data-dirty': dirty ? 'true' : 'false' },
				h('span', { className: 'nep-modDot', 'aria-hidden': true }),
				h('span', null, dirty ? t('pg.unsaved') : t('pg.savedState'))
			),
			fromRoute ? h('span', { className: 'nep-modChip' }, NestGlyph({ name: 'route', size: 10 }), h('span', null, t('pg.fromRoute'))) : null,
			summary !== '' ? h('span', { className: 'nep-modSummary', title: summary }, summary) : null
		)
	);
}

/** The full playground view rendered into the panel body. */
function NestPlaygroundView(props) {
	const t = props.t;
	const workspaceId = props.workspaceId === undefined ? null : props.workspaceId;
	const pane = nestUsePaneSession(workspaceId, t, true);

	const [phase, setPhase] = React.useState('boot');
	const [error, setError] = React.useState(null);
	const [files, setFiles] = React.useState(NEST_EMPTY);
	const [dirs, setDirs] = React.useState(NEST_EMPTY);
	const [collapsed, setCollapsed] = React.useState({});
	const [selection, setSelection] = React.useState(null);
	const [creating, setCreating] = React.useState(null);
	const [activePath, setActivePath] = React.useState(null);
	const [editorText, setEditorText] = React.useState('');
	const [savedText, setSavedText] = React.useState('');
	const [saving, setSaving] = React.useState(false);
	const [runtimeStatus, setRuntimeStatus] = React.useState(null);
	const [run, setRun] = React.useState(null);
	const [results, setResults] = React.useState(NEST_EMPTY);
	const [logsOpen, setLogsOpen] = React.useState(false);
	const [outputCollapsed, setOutputCollapsed] = React.useState(false);
	const [requestForm, setRequestForm] = React.useState({ method: 'GET', path: '/', body: '' });
	const [busy, setBusy] = React.useState(false);
	const [toast, setToast] = React.useState(null);
	const [filesLoading, setFilesLoading] = React.useState(true);
	const [modulesState, setModulesState] = React.useState({ phase: 'loading', modules: NEST_EMPTY, active: null });
	const [moduleBusy, setModuleBusy] = React.useState(false);
	const [routeOriginId, setRouteOriginId] = React.useState(null);
	const [createBusy, setCreateBusy] = React.useState(false);
	const [snapshotForm, setSnapshotForm] = React.useState(null);
	const [selectNonce, setSelectNonce] = React.useState(0);
	const pollTimerRef = React.useRef(null);
	const pollCountRef = React.useRef(0);
	const pollGenRef = React.useRef(0);
	const runRef = React.useRef(null);
	const moduleBusyRef = React.useRef(false);
	const createBusyRef = React.useRef(false);
	const initialModuleRef = React.useRef(null);
	runRef.current = run;

	const dirty = activePath !== null && editorText !== savedText;

	const showToast = (tone, text) => {
		setToast({ tone, text });
		window.setTimeout(() => setToast((current) => (current !== null && current.text === text ? null : current)), 6000);
	};

	const stopPolling = () => {
		if (pollTimerRef.current !== null) {
			window.clearTimeout(pollTimerRef.current);
			pollTimerRef.current = null;
		}
	};

	/** Keep the module bar's dirty state in sync with the Host (writes mark the workspace dirty). */
	const markModuleDirty = () => {
		setModulesState((current) => {
			if (current.active === null || typeof current.active !== 'object' || current.active.dirty === true) return current;
			return Object.assign({}, current, { active: Object.assign({}, current.active, { dirty: true }) });
		});
	};

	const pollRun = React.useCallback((runId) => {
		stopPolling();
		pollGenRef.current += 1;
		const generation = pollGenRef.current;
		const tick = async () => {
			if (pollGenRef.current !== generation) return;
			try {
				const payload = await nestFetchJson('/playground/poll?runId=' + encodeURIComponent(runId));
				if (pollGenRef.current !== generation) return;
				const snapshot = payload.run;
				setRun(snapshot);
				if (snapshot.status === 'running') {
					if (Array.isArray(snapshot.routes) && snapshot.routes.length > 0) {
						setRequestForm((current) => {
							if (current.path !== '/' && current.path !== '') return current;
							return nestPgRequestFor(snapshot.routes[0]);
						});
					}
				}
				pollCountRef.current += 1;
				const alive = snapshot.status === 'compiling' || snapshot.status === 'starting' || snapshot.status === 'running';
				if (alive && pollCountRef.current < 120) {
					pollTimerRef.current = window.setTimeout(tick, snapshot.status === 'running' ? 1500 : 600);
				}
			} catch (caught) {
				if (pollGenRef.current !== generation) return;
				stopPolling();
				setRun((current) => (current === null ? current : Object.assign({}, current, { status: 'failed', error: nestErrorMessage(caught) })));
			}
		};
		pollCountRef.current = 0;
		pollTimerRef.current = window.setTimeout(tick, 400);
	}, []);

	const loadFiles = React.useCallback(async () => {
		setFilesLoading(true);
		try {
			const payload = await nestFetchJson('/playground/files');
			const list = Array.isArray(payload.files) ? payload.files : NEST_EMPTY;
			const listDirs = Array.isArray(payload.dirs) ? payload.dirs : NEST_EMPTY;
			setFiles(list);
			setDirs(listDirs);
			return list;
		} finally {
			setFilesLoading(false);
		}
	}, []);

	/** Refresh the module list + active module/version from GET /playground/modules. */
	const loadModules = React.useCallback(async () => {
		const payload = await nestFetchJson('/playground/modules');
		const modules = Array.isArray(payload.modules) ? payload.modules : NEST_EMPTY;
		const active = payload.active === null || typeof payload.active !== 'object' ? null : payload.active;
		const next = { phase: 'ready', modules, active };
		setModulesState(next);
		return next;
	}, []);

	const openFile = React.useCallback(async (filePath) => {
		const payload = await nestFetchJson('/playground/file?path=' + encodeURIComponent(filePath));
		setActivePath(filePath);
		setSelection({ kind: 'file', path: filePath });
		setEditorText(String(payload.content === undefined ? '' : payload.content));
		setSavedText(String(payload.content === undefined ? '' : payload.content));
		setCollapsed((current) => nestPgExpanded(current, filePath));
	}, []);

	/** Force a controlled select to re-sync with the current active module/version. */
	const flashSelect = () => setSelectNonce((value) => value + 1);

	/** Clear every client-side run artifact after the app is stopped. */
	const clearClientRuntime = () => {
		pollGenRef.current += 1;
		stopPolling();
		setRun(null);
		runRef.current = null;
		setResults(NEST_EMPTY);
		setLogsOpen(false);
	};

	/** Stop the running app (ignored when nothing is running / Host is old). */
	const stopRuntime = async () => {
		try {
			await nestFetchJson('/playground/stop', { method: 'POST', body: JSON.stringify({}) });
		} catch (_caught) {
			/* the app may already be stopped */
		}
	};

	/**
	 * Reset the file-list/editor state after the workspace was replaced and
	 * reopen the module's preferred file (defaultFile → first .ts → first file).
	 */
	const resetWorkspaceView = async (defaultFile) => {
		setCreating(null);
		setCollapsed({});
		setSelection(null);
		setActivePath(null);
		setEditorText('');
		setSavedText('');
		const list = await loadFiles();
		const preferred = nestPgPreferredFile(list, defaultFile);
		if (preferred !== null) await openFile(preferred.path);
		return list;
	};

	/** Refresh modules, keeping the last known good bar visible on failure. */
	const refreshModules = async () => {
		try {
			return await loadModules();
		} catch (caught) {
			setModulesState((current) => (current.active === null ? { phase: 'error', modules: NEST_EMPTY, active: null } : current));
			return null;
		}
	};

	const boot = React.useCallback(async () => {
		setPhase('boot');
		setError(null);
		try {
			const status = await nestFetchJson('/status');
			setRuntimeStatus(status);
			if (status.knowledgeReady === false) showToast('warn', t('kb.loadFailed') + 'knowledge/data.json');
			let defaultFile = null;
			try {
				const loaded = await loadModules();
				defaultFile = loaded.active === null ? null : loaded.active.defaultFile;
			} catch (_caught) {
				setModulesState({ phase: 'error', modules: NEST_EMPTY, active: null });
			}
			const list = await loadFiles();
			const preferred = nestPgPreferredFile(list, defaultFile);
			if (preferred !== null) await openFile(preferred.path);
			setPhase('ready');
		} catch (caught) {
			setPhase('error');
			setError(nestErrorMessage(caught));
		}
	}, [t, loadFiles, openFile, loadModules]);

	React.useEffect(() => {
		boot();
		return () => stopPolling();
	}, [boot]);

	const selectFile = async (filePath) => {
		if (filePath === activePath) return;
		if (dirty && !window.confirm(t('pg.unsaved') + '：' + activePath + '\n' + t('common.continueAnyway'))) return;
		try {
			await openFile(filePath);
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
		}
	};

	/** Folder twisty: only expand/collapse, never changes the selection. */
	const toggleDir = (dirPath) => {
		setCollapsed((current) => {
			const next = Object.assign({}, current);
			if (next[dirPath] === true) delete next[dirPath];
			else next[dirPath] = true;
			return next;
		});
	};

	/** Folder label click: select it as the create/delete target (no collapsing). */
	const selectDir = (dirPath) => setSelection({ kind: 'dir', path: dirPath });

	/** Folder a new entry is created in: the selected folder, else the active file's folder. */
	const createParent = () => {
		if (selection !== null && selection.kind === 'dir') return selection.path;
		if (selection !== null && selection.kind === 'file') return nestPgDirOf(selection.path);
		if (activePath !== null) return nestPgDirOf(activePath);
		return '';
	};

	/** Open the inline create row, pre-filled with the target folder. */
	const beginCreate = (kind) => {
		let parent = createParent();
		if (parent === '') parent = 'src';
		setCreating({ kind, parent, value: parent + '/' });
	};

	const cancelCreate = () => setCreating(null);

	const submitCreate = async (event) => {
		if (event !== undefined && typeof event.preventDefault === 'function') event.preventDefault();
		if (creating === null || createBusyRef.current || moduleBusyRef.current) return;
		const kind = creating.kind;
		const checked = nestPgValidateEntry(creating.value, kind, creating.parent);
		if (checked.error !== undefined) {
			showToast('warn', t(checked.error));
			return;
		}
		const normalized = checked.value;
		const collision = files.some((file) => nestPgPathOf(file) === normalized) || dirs.some((dir) => nestPgPathOf(dir) === normalized);
		if (collision) {
			showToast('warn', nestFormat(t('pg.entryExists'), { path: normalized }));
			return;
		}
		createBusyRef.current = true;
		setCreateBusy(true);
		try {
			await nestFetchJson('/playground/entry', { method: 'POST', body: JSON.stringify({ path: normalized, kind }) });
			markModuleDirty();
			setCreating(null);
			setCollapsed((current) => nestPgExpanded(current, normalized));
			await loadFiles();
			if (kind !== 'file') {
				setSelection({ kind: 'dir', path: normalized });
			} else if (!dirty || activePath === null || window.confirm(nestFormat(t('pg.openNewConfirm'), { path: normalized }))) {
				await openFile(normalized);
			} else {
				setSelection({ kind: 'file', path: normalized });
			}
			showToast('success', nestFormat(t('pg.created'), { path: normalized }));
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
		} finally {
			createBusyRef.current = false;
			setCreateBusy(false);
		}
	};

	const deleteSelection = async () => {
		if (moduleBusyRef.current) return;
		if (selection === null) return;
		if (!nestPgDeletable(selection)) {
			showToast('warn', t('pg.protectedEntry'));
			return;
		}
		const target = selection.path;
		const isDir = selection.kind === 'dir';
		const message = isDir ? nestFormat(t('pg.deleteDirConfirm'), { path: target }) : nestFormat(t('pg.deleteConfirm'), { path: target });
		if (!window.confirm(message)) return;
		try {
			await nestFetchJson('/playground/entry', { method: 'DELETE', body: JSON.stringify({ path: target }) });
			markModuleDirty();
			const list = await loadFiles();
			setSelection(null);
			const removedActive = activePath !== null && (activePath === target || activePath.indexOf(target + '/') === 0);
			if (removedActive) {
				setActivePath(null);
				setEditorText('');
				setSavedText('');
				const fallback = nestPgPreferredFile(list, modulesState.active === null ? null : modulesState.active.defaultFile);
				if (fallback !== null) await openFile(fallback.path);
			}
			showToast('success', t('pg.deleted'));
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
		}
	};

	const saveFile = async () => {
		if (activePath === null) return true;
		if (moduleBusyRef.current) return false;
		setSaving(true);
		let saved = false;
		try {
			await nestFetchJson('/playground/file', { method: 'PUT', body: JSON.stringify({ path: activePath, content: editorText }) });
			setSavedText(editorText);
			markModuleDirty();
			await loadFiles();
			showToast('success', t('pg.saved'));
			saved = true;
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
		} finally {
			setSaving(false);
		}
		return saved;
	};

	const beginModuleOperation = () => {
		moduleBusyRef.current = true;
		setModuleBusy(true);
	};

	const endModuleOperation = () => {
		moduleBusyRef.current = false;
		setModuleBusy(false);
	};

	/**
	 * Switch the active code module (SPEC §8): confirm when dirty, stop the app,
	 * clear client run state, replace the workspace, reload files, reset the
	 * tree/editor state and open the module's default file.
	 */
	const switchModule = async (moduleId, options) => {
		const opts = options === null || typeof options !== 'object' ? {} : options;
		if (typeof moduleId !== 'string' || moduleId === '') return;
		if (moduleBusyRef.current) {
			flashSelect();
			return;
		}
		const active = modulesState.active;
		if (active !== null && active.moduleId === moduleId && opts.force !== true) {
			if (typeof opts.onDone === 'function') opts.onDone(active);
			return;
		}
		if (active !== null && (active.dirty === true || dirty) && opts.skipConfirm !== true && !window.confirm(t('pg.dirtySwitchConfirm'))) {
			flashSelect();
			return;
		}
		beginModuleOperation();
		if (opts.skipConfirm !== true) setRouteOriginId(null);
		try {
			clearClientRuntime();
			await stopRuntime();
			const payload = await nestFetchJson('/playground/module', { method: 'POST', body: JSON.stringify({ moduleId }) });
			const nextActive = payload.active === null || typeof payload.active !== 'object' ? null : payload.active;
			await resetWorkspaceView(nextActive === null ? null : nextActive.defaultFile);
			await loadModules();
			showToast('success', t('pg.switchedModule'));
			if (typeof opts.onDone === 'function') opts.onDone(nextActive);
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
			const refreshed = await refreshModules();
			const after = refreshed === null || refreshed.active === null || typeof refreshed.active !== 'object' ? null : refreshed.active;
			if (after !== null && (active === null || after.moduleId !== active.moduleId)) await resetWorkspaceView(after.defaultFile);
			flashSelect();
		} finally {
			endModuleOperation();
		}
	};

	/** Load one code version (`default` or a snapshot id) of the active module. */
	const loadVersion = async (value) => {
		if (moduleBusyRef.current) {
			flashSelect();
			return;
		}
		const active = modulesState.active;
		if (active === null) return;
		if (value === nestPgVersionValue(active)) return;
		if ((active.dirty === true || dirty) && !window.confirm(t('pg.dirtySwitchConfirm'))) {
			flashSelect();
			return;
		}
		const request = value === 'default' ? { kind: 'default' } : { kind: 'snapshot', snapshotId: value };
		beginModuleOperation();
		try {
			clearClientRuntime();
			await stopRuntime();
			const payload = await nestFetchJson('/playground/version', { method: 'POST', body: JSON.stringify(request) });
			const nextActive = payload.active === null || typeof payload.active !== 'object' ? null : payload.active;
			await resetWorkspaceView(nextActive === null ? null : nextActive.defaultFile);
			await loadModules();
			setRouteOriginId(null);
			showToast('success', t('pg.switchedVersion'));
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
			await refreshModules();
			flashSelect();
		} finally {
			endModuleOperation();
		}
	};

	/** Restore the active module's default code (SPEC §8 reset flow). */
	const resetCurrentModule = async () => {
		if (moduleBusyRef.current) return;
		if (!window.confirm(t('pg.resetModuleConfirm'))) return;
		beginModuleOperation();
		try {
			clearClientRuntime();
			await stopRuntime();
			const payload = await nestFetchJson('/playground/reset', { method: 'POST', body: JSON.stringify({}) });
			const nextActive = payload.active === null || typeof payload.active !== 'object' ? null : payload.active;
			await resetWorkspaceView(nextActive === null ? null : nextActive.defaultFile);
			await loadModules();
			setRouteOriginId(null);
			showToast('success', t('pg.resetModuleDone'));
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
		} finally {
			endModuleOperation();
		}
	};

	/** Save the current workspace as a named code version of the module. */
	/**
	 * Open the inline "save version" form. We cannot use `window.prompt` here:
	 * the Electron shell does not implement it, so a prompt-based flow silently
	 * does nothing on click.
	 */
	const beginSnapshotSave = () => {
		if (moduleBusyRef.current) return;
		const active = modulesState.active;
		if (active === null) return;
		const current = nestPgFindModule(modulesState.modules, active.moduleId);
		const snapshots = current !== null && Array.isArray(current.snapshots) ? current.snapshots : NEST_EMPTY;
		const preferred = active.version !== null && typeof active.version === 'object' && typeof active.version.name === 'string' && active.version.name.trim() !== ''
			? active.version.name.trim()
			: t('pg.snapshotDefaultName');
		setSnapshotForm({ value: nestPgNextSnapshotName(snapshots, preferred), busy: false });
	};

	const cancelSnapshotSave = () => setSnapshotForm(null);

	/** Capture the workspace as a named version; returns true on success. */
	const performSnapshotSave = async (name) => {
		beginModuleOperation();
		try {
			if (dirty && activePath !== null) {
				const saved = await saveFile();
				if (!saved) return false;
			}
			/* The Host stops the running app before capturing the snapshot (§7). */
			clearClientRuntime();
			await nestFetchJson('/playground/snapshot', { method: 'POST', body: JSON.stringify({ name }) });
			await loadModules();
			setRouteOriginId(null);
			showToast('success', nestFormat(t('pg.snapshotSaved'), { name }));
			return true;
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
			return false;
		} finally {
			endModuleOperation();
		}
	};

	const submitSnapshotSave = async (event) => {
		if (event !== undefined && typeof event.preventDefault === 'function') event.preventDefault();
		if (snapshotForm === null || moduleBusyRef.current) return;
		const name = String(snapshotForm.value === undefined || snapshotForm.value === null ? '' : snapshotForm.value).trim();
		if (name === '') {
			showToast('warn', t('pg.snapshotNameRequired'));
			return;
		}
		setSnapshotForm((current) => (current === null ? current : Object.assign({}, current, { busy: true })));
		const saved = await performSnapshotSave(name);
		if (saved) setSnapshotForm(null);
		else setSnapshotForm((current) => (current === null ? current : Object.assign({}, current, { busy: false })));
	};

	/**
	 * Delete the snapshot the active module currently uses. The Host refuses to
	 * delete the in-use version (§6), so switch the module to its default code
	 * first, then delete the snapshot and refresh the module list.
	 */
	const deleteCurrentSnapshot = async () => {
		if (moduleBusyRef.current) return;
		const active = modulesState.active;
		if (active === null || active.version === null || typeof active.version !== 'object') return;
		if (active.version.kind !== 'snapshot' || typeof active.version.snapshotId !== 'string') return;
		if (!window.confirm(t('pg.deleteSnapshotConfirm'))) return;
		const snapshotId = active.version.snapshotId;
		beginModuleOperation();
		try {
			clearClientRuntime();
			await stopRuntime();
			const switched = await nestFetchJson('/playground/version', { method: 'POST', body: JSON.stringify({ kind: 'default' }) });
			const nextActive = switched.active === null || typeof switched.active !== 'object' ? null : switched.active;
			await resetWorkspaceView(nextActive === null ? null : nextActive.defaultFile);
			await nestFetchJson('/playground/snapshot', { method: 'DELETE', body: JSON.stringify({ snapshotId }) });
			await loadModules();
			setRouteOriginId(null);
			showToast('success', t('pg.snapshotDeleted'));
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
			await refreshModules();
		} finally {
			endModuleOperation();
		}
	};

	const switchModuleRef = React.useRef(null);
	switchModuleRef.current = switchModule;

	/**
	 * Learning-route hand-off: `initialModuleId` switches modules without a
	 * confirm. Unknown ids toast and keep the current module. The callback is
	 * invoked after handling — including when the module is already active —
	 * so the panel can clear its pending id.
	 */
	React.useEffect(() => {
		const target = typeof props.initialModuleId === 'string' && props.initialModuleId !== '' ? props.initialModuleId : null;
		const consumed = typeof props.onInitialModuleConsumed === 'function' ? props.onInitialModuleConsumed : null;
		if (target === null) {
			initialModuleRef.current = null;
			return;
		}
		if (initialModuleRef.current === target) return;
		if (phase !== 'ready' || modulesState.phase !== 'ready') return;
		/* Another module operation is running: retry when its state update lands. */
		if (moduleBusyRef.current) return;
		initialModuleRef.current = target;
		const active = modulesState.active;
		if (active !== null && active.moduleId === target) {
			if (consumed !== null) consumed();
			return;
		}
		if (nestPgFindModule(modulesState.modules, target) === null) {
			showToast('warn', nestFormat(t('pg.unknownModule'), { id: target }));
			if (consumed !== null) consumed();
			return;
		}
		setRouteOriginId(target);
		switchModuleRef.current(target, { skipConfirm: true });
		if (consumed !== null) consumed();
	}, [phase, props.initialModuleId, props.onInitialModuleConsumed, modulesState, t]);

	const startRun = async () => {
		if (busy || moduleBusyRef.current) return;
		setBusy(true);
		setRun({ status: 'compiling', logs: [], routes: [] });
		setResults(NEST_EMPTY);
		try {
			if (dirty) {
				const saved = await saveFile();
				if (!saved) return;
			}
			const payload = await nestFetchJson('/playground/run', { method: 'POST', body: JSON.stringify({}) });
			pollRun(payload.runId);
		} catch (caught) {
			setRun({ status: 'failed', logs: [], routes: [], error: nestErrorMessage(caught) });
		} finally {
			setBusy(false);
		}
	};

	const stopRun = async () => {
		try {
			await nestFetchJson('/playground/stop', { method: 'POST', body: JSON.stringify({}) });
			if (runRef.current !== null && runRef.current.runId !== undefined) pollRun(runRef.current.runId);
			else setRun(null);
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
		}
	};

	const sendRequest = async (override) => {
		if (run === null || run.status !== 'running' || run.runId === undefined) {
			showToast('warn', t('pg.notRunning'));
			return;
		}
		const method = override !== undefined ? override.method : requestForm.method;
		const requestPath = override !== undefined ? override.path : requestForm.path;
		const body = override !== undefined ? override.body : requestForm.body;
		if (typeof requestPath !== 'string' || requestPath.trim() === '') {
			showToast('warn', t('pg.pathRequired'));
			return;
		}
		try {
			const payload = await nestFetchJson('/playground/request', {
				method: 'POST',
				body: JSON.stringify({ runId: run.runId, method, path: requestPath.trim(), body: typeof body === 'string' && body.trim() !== '' ? body : undefined })
			});
			const response = payload.response;
			setResults((current) => current.concat([{
				key: nestRequestId(),
				method,
				path: requestPath.trim(),
				status: response.status,
				body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
				timeMs: response.timeMs,
				error: response.status === 0 ? (response.error === undefined ? t('pg.error') : response.error) : undefined
			}]));
		} catch (caught) {
			showToast('error', nestErrorMessage(caught));
		}
	};

	const autoTest = async () => {
		if (run === null || run.status !== 'running' || !Array.isArray(run.routes)) {
			showToast('warn', t('pg.notRunning'));
			return;
		}
		const routes = run.routes.slice(0, 12);
		for (const route of routes) {
			// 用运行时真实注册的 HTTP 方法，否则自测会把所有路由都当成 GET 发出去。
			const method = String(route.method === undefined || route.method === null ? 'GET' : route.method).toUpperCase();
			const requestPath = String(route.path).replace(/:[A-Za-z0-9_]+/g, '1');
			// 带请求体的方法给一个空 JSON 占位，否则 POST/PATCH/PUT 多半直接 400 而不是走到业务逻辑。
			const withBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
			await sendRequest({ method, path: requestPath, body: withBody ? '{}' : '' });
		}
	};

	const askAboutError = () => {
		if (typeof props.onAskAi !== 'function') return;
		const logText = (run !== null && Array.isArray(run.logs) ? run.logs.slice(-40).join('\n') : (error === null ? '' : error));
		props.onAskAi(nestFormat(t('pg.errorPrompt'), { log: nestClipText(logText, 3000) }));
	};

	const currentRunPhase = run === null ? null : run.status;
	const running = currentRunPhase === 'running';
	const starting = currentRunPhase === 'compiling' || currentRunPhase === 'starting';

	let editorArea = null;
	if (phase === 'boot') {
		editorArea = h('div', { className: 'ne-loadingLine' }, NestSpinner({}), h('span', null, t('pg.loadingFiles')));
	} else if (phase === 'error') {
		editorArea = h('div', { className: 'ne-errorBox' },
			h('div', null, t('pg.unavailable') + String(error === null ? '' : error)),
			h('div', { className: 'ne-pillRow' },
				h('button', { className: 'ne-btn', type: 'button', onClick: boot }, t('common.retry')),
				runtimeStatus !== null && runtimeStatus.nodePath !== undefined ? h('span', { className: 'ne-chip ne-chipSoft' }, 'node: ' + runtimeStatus.nodePath) : null
			)
		);
	} else if (activePath === null) {
		editorArea = h('div', { className: 'ne-empty' }, NestGlyph({ name: 'file', size: 24 }), h('p', null, t('pg.selectFile')));
	} else {
		editorArea = h(NestPgEditor, {
			value: editorText,
			onChange: setEditorText,
			label: t('pg.editor') + ' · ' + activePath
		});
	}

	const statusTone = running ? 'running' : starting ? 'warn' : currentRunPhase === 'failed' ? 'error' : 'idle';
	const statusLabel = running ? t('pg.ready') : starting ? t('pg.starting') : currentRunPhase === 'failed' ? t('pg.failed') : currentRunPhase === 'stopped' ? t('pg.stopped') : t('pg.stopped');
	const logs = run !== null && Array.isArray(run.logs) ? run.logs : NEST_EMPTY;
	const routes = run !== null && Array.isArray(run.routes) ? run.routes : NEST_EMPTY;

	return h('section', { className: 'nep-page', 'aria-label': t('pg.title') },
		h('style', { key: 'playground-styles' }, NEST_CSS_PLAYGROUND),
		h('div', { className: 'nep-split' },
			h('div', { className: 'nep-left' },
				h(NestChatPane, {
					t,
					pane,
					pendingPrompt: props.queuedPrompt,
					onPromptSent: props.onPromptSent
				})
			),
			h('div', { className: 'nep-right' },
				h('header', { className: 'nep-toolbar' },
					h('div', { className: 'nep-toolbarText' },
						h('h2', { className: 'nep-title' }, t('pg.title')),
						h('p', { className: 'nep-desc' }, t('pg.desc'))
					),
					h('div', { className: 'nep-toolbarActions' },
						NestStatusPill({ tone: statusTone }, statusLabel),
						h('button', { className: 'ne-btn ne-btnPrimary', type: 'button', disabled: busy || starting || moduleBusy, onClick: startRun, title: t('pg.run') },
							NestGlyph({ name: 'play', size: 13 }), h('span', null, starting ? t('pg.running') : t('pg.run'))),
						h('button', { className: 'ne-btn', type: 'button', disabled: (!running && !starting) || moduleBusy, onClick: stopRun },
							NestGlyph({ name: 'stop', size: 13 }), h('span', null, t('pg.stop'))),
						h('button', { className: 'ne-btn ne-btnGhost', type: 'button', disabled: moduleBusy, onClick: resetCurrentModule, title: t('pg.resetToDefault') },
							NestGlyph({ name: 'refresh', size: 13 })),
						h('button', { className: 'ne-btn ne-btnGhost', type: 'button', onClick: boot, title: t('common.refresh') },
							NestGlyph({ name: 'refresh', size: 13 }))
					)
				),
				h(NestPgModuleBar, {
					key: 'module-bar:' + String(selectNonce),
					t,
					state: modulesState,
					busy: moduleBusy,
					fromRoute: routeOriginId !== null && modulesState.active !== null && modulesState.active.moduleId === routeOriginId,
					onSwitchModule: switchModule,
					onLoadVersion: loadVersion,
					onSaveSnapshot: beginSnapshotSave,
					onResetDefault: resetCurrentModule,
					onDeleteSnapshot: deleteCurrentSnapshot,
					onRetry: () => { refreshModules(); },
					snapshotForm,
					onSnapshotChange: (value) => setSnapshotForm((current) => (current === null ? current : Object.assign({}, current, { value }))),
					onSnapshotSubmit: submitSnapshotSave,
					onSnapshotCancel: cancelSnapshotSave
				}),
				h('div', { className: 'nep-main' },
					h('aside', { className: 'nep-files' },
						h('div', { className: 'nep-filesHead' },
							h('span', { className: 'nep-filesTitle' }, NestGlyph({ name: 'folder', size: 13 }), h('span', null, t('pg.files'))),
							h('div', { className: 'nep-fileActions' },
								h('button', { className: 'ne-iconBtn', type: 'button', title: t('pg.newFile'), 'aria-label': t('pg.newFile'), disabled: moduleBusy, onClick: () => beginCreate('file') }, NestGlyph({ name: 'plus', size: 14 })),
								h('button', { className: 'ne-iconBtn', type: 'button', title: t('pg.newFolder'), 'aria-label': t('pg.newFolder'), disabled: moduleBusy, onClick: () => beginCreate('dir') }, NestGlyph({ name: 'folderPlus', size: 14 })),
								h('button', { className: 'ne-iconBtn', type: 'button', title: t('pg.deleteEntry'), 'aria-label': t('pg.deleteEntry'), disabled: !nestPgDeletable(selection) || moduleBusy, onClick: deleteSelection }, NestGlyph({ name: 'trash', size: 14 }))
							)
						),
						creating === null
							? null
							: h(NestPgCreateBar, {
								t,
								kind: creating.kind,
								value: creating.value,
								disabled: createBusy,
								onChange: (value) => setCreating({ kind: creating.kind, parent: creating.parent, value }),
								onSubmit: submitCreate,
								onCancel: cancelCreate
							}),
						h(NestPgFileTree, {
							t,
							files,
							dirs,
							loading: filesLoading,
							collapsed,
							selection,
							activePath,
							onToggleDir: toggleDir,
							onSelectDir: selectDir,
							onSelectFile: selectFile
						})
					),
					h('div', { className: 'nep-editorPane' },
						h('div', { className: 'nep-editorHead' },
							h('code', { className: 'nep-editorPath' }, activePath === null ? '' : activePath),
							h('span', { className: 'nep-themeBadge' }, 'One Dark'),
							dirty ? h('span', { className: 'nep-dirty' }, t('pg.unsaved')) : null,
							h('div', { className: 'nep-editorActions' },
								h('button', { className: 'ne-btn ne-btnSmall', type: 'button', disabled: !dirty || saving || moduleBusy, onClick: saveFile, title: t('pg.saveFile') + '（' + t('pg.saveSnapshot') + '）' },
									NestGlyph({ name: 'save', size: 12 }), h('span', null, saving ? t('pg.saving') : t('pg.saveFile')))
							)
						),
						editorArea
					)
				),
				h('div', { className: 'nep-output', 'data-collapsed': outputCollapsed ? 'true' : 'false' },
					h('div', { className: 'nep-outputHead' },
						h('div', { className: 'nep-outputTitle' }, NestGlyph({ name: 'terminal', size: 13 }), h('span', null, t('pg.output'))),
						routes.length > 0
							? h('div', { className: 'nep-routeChips' }, routes.map((route) => h('button', {
								key: route.method + ' ' + route.path,
								className: 'nep-routeChip',
								type: 'button',
								onClick: () => setRequestForm(nestPgRequestFor(route)),
								title: t('pg.request')
							}, h('span', { className: 'nep-method' }, route.method), h('span', null, route.path))))
							: null,
						h('div', { className: 'nep-outputActions' },
							h('button', { className: 'ne-btn ne-btnSmall', type: 'button', disabled: !running, onClick: autoTest }, t('pg.autoTest')),
							h('button', { className: 'ne-btn ne-btnSmall ne-btnGhost', type: 'button', onClick: () => setResults(NEST_EMPTY), disabled: results.length === 0 }, t('pg.clearResults')),
							h('button', { className: 'ne-btn ne-btnSmall ne-btnGhost', type: 'button', onClick: () => setLogsOpen((value) => !value) }, t('pg.logs') + ' (' + String(logs.length) + ')'),
							h('button', {
								className: 'ne-iconBtn nep-outputToggle',
								type: 'button',
								title: outputCollapsed ? t('pg.expandOutput') : t('pg.collapseOutput'),
								'aria-label': outputCollapsed ? t('pg.expandOutput') : t('pg.collapseOutput'),
								'aria-expanded': outputCollapsed ? 'false' : 'true',
								onClick: () => setOutputCollapsed((value) => !value)
							}, NestGlyph({ name: outputCollapsed ? 'chevronUp' : 'chevronDown', size: 14 }))
						)
					),
					run !== null && run.error !== undefined && run.error !== null && run.error !== ''
						? h('div', { className: 'nep-runError' },
							h('span', null, String(run.error)),
							h('button', { className: 'ne-linkBtn', type: 'button', onClick: askAboutError }, t('pg.askAiAboutError')))
						: null,
					h('div', { className: 'nep-console' },
						h('div', { className: 'nep-requestForm' },
							h('select', {
								className: 'ne-select nep-methodSelect',
								value: requestForm.method,
								'aria-label': t('pg.method'),
								onChange: (event) => setRequestForm((current) => Object.assign({}, current, { method: event.target.value }))
							}, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => h('option', { key: method, value: method }, method))),
							h('input', {
								className: 'ne-input nep-pathInput',
								value: requestForm.path,
								placeholder: '/cats',
								'aria-label': t('pg.path'),
								onChange: (event) => setRequestForm((current) => Object.assign({}, current, { path: event.target.value }))
							}),
							h('button', { className: 'ne-btn ne-btnPrimary', type: 'button', disabled: !running, onClick: () => sendRequest() }, NestGlyph({ name: 'send', size: 12 }), h('span', null, t('pg.send'))),
							requestForm.method === 'GET'
								? null
								: h('textarea', {
									className: 'ne-input nep-bodyInput',
									rows: 2,
									value: requestForm.body,
									placeholder: t('pg.body'),
									'aria-label': t('pg.body'),
									onChange: (event) => setRequestForm((current) => Object.assign({}, current, { body: event.target.value }))
								})
						),
						logsOpen
							? h('pre', { className: 'nep-logs' }, logs.length === 0 ? t('pg.noLogs') : logs.join('\n'))
							: null,
						h('div', { className: 'nep-results ne-scroll' },
							results.length === 0
								? h('p', { className: 'ne-muted nep-resultsEmpty' }, t('pg.noResults'))
								: results.map((result) => h(NestPgResult, { key: result.key, t, result }))
						)
					)
				)
			)
		),
		toast === null ? null : h('div', { className: 'ne-toast', 'data-tone': toast.tone, role: 'status' }, toast.text)
	);
}
// #endregion
