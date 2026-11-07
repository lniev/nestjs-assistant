// #region glyphs
// Small outline glyphs used across the panel. Decorative and color-inheriting;
// the shell renders the accessible labels itself.

/** One outline glyph by name. */
function NestGlyph(props) {
	const name = props.name;
	const size = props.size === undefined ? 16 : props.size;
	const stroke = props.strokeWidth === undefined ? 1.7 : props.strokeWidth;
	const common = {
		width: size,
		height: size,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: stroke,
		strokeLinecap: 'round',
		strokeLinejoin: 'round',
		'aria-hidden': true,
		className: 'ne-glyph'
	};
	if (name === 'search') return h('svg', common, h('circle', { cx: 11, cy: 11, r: 6.5 }), h('path', { d: 'm16 16 4.2 4.2' }));
	if (name === 'book') return h('svg', common,
		h('path', { d: 'M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v15H7a2.5 2.5 0 0 0-2.5 2.5Z' }),
		h('path', { d: 'M4.5 5.5v15' })
	);
	if (name === 'map') return h('svg', common,
		h('path', { d: 'm3.5 6.5 5-2 7 2 5-2v13l-5 2-7-2-5 2Z' }),
		h('path', { d: 'M8.5 4.5v13' }),
		h('path', { d: 'M15.5 6.5v13' })
	);
	if (name === 'route') return h('svg', common,
		h('circle', { cx: 6, cy: 18, r: 2.2 }),
		h('circle', { cx: 18, cy: 6, r: 2.2 }),
		h('path', { d: 'M8.2 18h5.3a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h5.8' })
	);
	if (name === 'play') return h('svg', common, h('path', { d: 'M8 5.2v13.6L19 12Z' }));
	if (name === 'stop') return h('svg', common, h('rect', { x: 6.5, y: 6.5, width: 11, height: 11, rx: 2 }));
	if (name === 'send') return h('svg', common, h('path', { d: 'M12 19V5' }), h('path', { d: 'm5.5 11.5 6.5-6.5 6.5 6.5' }));
	if (name === 'refresh') return h('svg', common, h('path', { d: 'M20 11.5A8 8 0 1 0 12 20a8 8 0 0 0 6.9-4' }), h('path', { d: 'M20 4.5v7h-7' }));
	if (name === 'chevron') return h('svg', common, h('path', { d: 'm9 5.5 6.5 6.5L9 18.5' }));
	if (name === 'chevronDown') return h('svg', common, h('path', { d: 'm5.5 9 6.5 6.5L18.5 9' }));
	if (name === 'chevronUp') return h('svg', common, h('path', { d: 'm5.5 15 6.5-6.5 6.5 6.5' }));
	if (name === 'table') return h('svg', common, h('rect', { x: 4, y: 5, width: 16, height: 14, rx: 2 }), h('path', { d: 'M4 10h16' }), h('path', { d: 'M10 10v9' }));
	if (name === 'folder') return h('svg', common, h('path', { d: 'M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z' }));
	if (name === 'file') return h('svg', common,
		h('path', { d: 'M6 3.5h7l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z' }),
		h('path', { d: 'M13 3.5V9h5' })
	);
	if (name === 'code') return h('svg', common, h('path', { d: 'm8 8-4 4 4 4' }), h('path', { d: 'm16 8 4 4-4 4' }), h('path', { d: 'm13.5 5-3 14' }));
	if (name === 'check') return h('svg', common, h('path', { d: 'm5 12.5 4.2 4.2L19 6.9' }));
	if (name === 'alert') return h('svg', common, h('path', { d: 'M12 4 21 20H3Z' }), h('path', { d: 'M12 10v4' }), h('path', { d: 'M12 17h.01' }));
	if (name === 'info') return h('svg', common, h('circle', { cx: 12, cy: 12, r: 8 }), h('path', { d: 'M12 11v5' }), h('path', { d: 'M12 8h.01' }));
	if (name === 'external') return h('svg', common,
		h('path', { d: 'M13.5 4.5H19.5V10.5' }),
		h('path', { d: 'M19.5 4.5 11 13' }),
		h('path', { d: 'M18.5 14v4.5a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1H10' })
	);
	if (name === 'terminal') return h('svg', common,
		h('rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 }),
		h('path', { d: 'm7 10 3 2.5L7 15' }),
		h('path', { d: 'M12.5 15.5H17' })
	);
	if (name === 'spark') return h('svg', common,
		h('path', { d: 'M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5L4.5 11 10 9Z' }),
		h('path', { d: 'M19 17.5 20 20l2.5 1-2.5 1-1 2.5' })
	);
	if (name === 'layers') return h('svg', common,
		h('path', { d: 'm12 3.5 9 5-9 5-9-5Z' }),
		h('path', { d: 'm3.5 12.5 8.5 4.7 8.5-4.7' }),
		h('path', { d: 'm3.5 16.8 8.5 4.7 8.5-4.7' })
	);
	if (name === 'arrowLeft') return h('svg', common, h('path', { d: 'M19 12H5' }), h('path', { d: 'm11 6-6 6 6 6' }));
	if (name === 'arrowRight') return h('svg', common, h('path', { d: 'M5 12h14' }), h('path', { d: 'm13 6 6 6-6 6' }));
	if (name === 'plus') return h('svg', common, h('path', { d: 'M12 5v14' }), h('path', { d: 'M5 12h14' }));
	if (name === 'folderPlus') return h('svg', common,
		h('path', { d: 'M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z' }),
		h('path', { d: 'M12 10.5v5' }),
		h('path', { d: 'M9.5 13h5' })
	);
	if (name === 'trash') return h('svg', common,
		h('path', { d: 'M4.5 6.5h15' }),
		h('path', { d: 'M9 6.5V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' }),
		h('path', { d: 'M6.5 6.5 7.5 20a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l1-13.5' })
	);
	if (name === 'save') return h('svg', common,
		h('path', { d: 'M5 4.5h11l3.5 3.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z' }),
		h('path', { d: 'M8 4.5V9h7V4.5' }),
		h('path', { d: 'M8 20v-5h8v5' })
	);
	if (name === 'copy') return h('svg', common,
		h('rect', { x: 8.5, y: 8.5, width: 11, height: 11, rx: 2 }),
		h('path', { d: 'M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3' })
	);
	if (name === 'clock') return h('svg', common, h('circle', { cx: 12, cy: 12, r: 8 }), h('path', { d: 'M12 7.5V12l3 2' }));
	if (name === 'compass') return h('svg', common, h('circle', { cx: 12, cy: 12, r: 8.5 }), h('path', { d: 'm15.5 8.5-2.1 5-5 2.1 2.1-5Z' }));
	if (name === 'target') return h('svg', common, h('circle', { cx: 12, cy: 12, r: 8 }), h('circle', { cx: 12, cy: 12, r: 3.5 }));
	if (name === 'shield') return h('svg', common, h('path', { d: 'M12 3.5 19.5 6v6c0 4-3 7-7.5 8.5C7.5 19 4.5 16 4.5 12V6Z' }), h('path', { d: 'm8.8 12 2.2 2.2 4.2-4.4' }));
	return h('svg', common, h('circle', { cx: 12, cy: 12, r: 8 }));
}

/** Decorative panel entry mark shown in the sidebar list. */
function NestPanelIcon(props) {
	const size = props.size === undefined ? 16 : props.size;
	return h('svg', {
		width: size,
		height: size,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 1.6,
		strokeLinecap: 'round',
		strokeLinejoin: 'round',
		'aria-hidden': true,
		className: 'ne-glyph'
	},
		h('path', { d: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z' }),
		h('path', { d: 'M8 6.2v3.1c0 1.1.8 1.9 2 1.9s2-.8 2-1.9V6.2' }),
		h('path', { d: 'M12 11.2V17.8' }),
		h('path', { d: 'M12 11.2l2.6-1.5v3.4l-2.6 1.5' })
	);
}

/** Small status dot + label used by the playground toolbar. */
function NestStatusPill(props) {
	const tone = props.tone === undefined ? 'idle' : props.tone;
	return h('span', { className: 'ne-statusPill', 'data-tone': tone },
		h('span', { className: 'ne-statusDot', 'aria-hidden': true }),
		h('span', null, props.children)
	);
}

/** Round spinner. */
function NestSpinner(props) {
	const onBrand = props.onBrand === true;
	return h('span', { className: onBrand ? 'ne-spinner ne-spinnerOnBrand' : 'ne-spinner', 'aria-hidden': true });
}
// #endregion
