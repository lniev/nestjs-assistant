// #region sessions
// The playground chat pane is an ordinary DSH session: it is created in the
// chosen workspace, renamed, seeded with a coach setup message, and then read
// through the Gateway Remote API (`remote.session.follow` + `observeState`).
// Sending a message is a normal `remote.session.prompt`, so the session stays
// visible in the sidebar, replayable and forkable like any other conversation.

/** Captured Client root context; chat code resolves services through it. */
let nestClientContext = null;

/** Prefix of the seeded persona message; the pane folds it into a setup row. */
const NEST_SETUP_MARK = '〔NEST·设定〕';

/** Initial page budget for the opening snapshot of the coach session. */
const NEST_FOLLOW_WINDOW = { maxMessages: 140, turnWindow: { minMessages: 90, minTurns: 8 } };

/** Map of `workspaceId:coach` -> in-flight ensure promise. */
const nestSessionJobs = new Map();

/** Read a persisted managed-session id for one workspace. */
function nestReadSessionId(workspaceId) {
	const store = nestReadStore('sessions', null);
	if (store === null || typeof store !== 'object') return null;
	const value = store[workspaceId];
	return typeof value === 'string' && value !== '' ? value : null;
}

/** Persist a managed-session id for one workspace. */
function nestWriteSessionId(workspaceId, sessionId) {
	const store = nestReadStore('sessions', null);
	const next = store !== null && typeof store === 'object' ? Object.assign({}, store) : {};
	next[workspaceId] = sessionId;
	nestWriteStore('sessions', next);
}

/** Forget the managed-session id for one workspace (used by "new round"). */
function nestForgetSessionId(workspaceId) {
	const store = nestReadStore('sessions', null);
	if (store === null || typeof store !== 'object') return;
	const next = Object.assign({}, store);
	delete next[workspaceId];
	nestWriteStore('sessions', next);
	nestSessionJobs.delete(workspaceId + ':coach');
}

/** Resolve one RemoteResult and throw a readable error on failure. */
function nestUnwrapRemote(result, action) {
	if (result !== null && result !== undefined && result.ok === true) return result.value;
	const error = result !== null && result !== undefined ? result.error : undefined;
	const code = error !== null && error !== undefined && typeof error.code === 'string' ? error.code : '';
	const message = error !== null && error !== undefined && typeof error.message === 'string' ? error.message : 'unknown error';
	throw new Error(action + ': ' + (code !== '' ? code + ': ' : '') + message);
}

/** Compose the seeded coach persona prompt (stable prefix for folding). */
function nestPersonaPrompt(t) {
	return NEST_SETUP_MARK + '\n' + t('chat.persona');
}

/**
 * Ensure the coach session exists for `workspaceId`. Reuses the persisted id
 * when the session still exists; otherwise creates, renames and seeds it.
 * Concurrent callers share one in-flight job.
 */
function nestEnsureSession(workspaceId, t) {
	const jobKey = workspaceId + ':coach';
	const inFlight = nestSessionJobs.get(jobKey);
	if (inFlight !== undefined) return inFlight;
	const job = (async () => {
		const stored = nestReadSessionId(workspaceId);
		if (stored !== null) {
			try {
				const state = await nestClientContext.remote.session.state({ sessionId: stored });
				if (state !== null && state !== undefined && state.ok === true) return stored;
			} catch (_error) {
				/* treat a failed check as a missing session */
			}
			nestForgetSessionId(workspaceId);
		}
		const created = await nestClientContext.remote.session.create({ workspaceId });
		const value = nestUnwrapRemote(created, 'create session');
		const sessionId = value.sessionId;
		nestWriteSessionId(workspaceId, sessionId);
		try {
			await nestClientContext.remote.session.rename({ sessionId, title: t('chat.title') + ' · ' + t('pg.title') });
		} catch (_error) {
			/* the title is cosmetic */
		}
		try {
			await nestSendPrompt(sessionId, nestPersonaPrompt(t));
		} catch (_error) {
			/* seeding is best-effort; the pane stays usable */
		}
		return sessionId;
	})();
	nestSessionJobs.set(jobKey, job);
	job.then(function () {}, function () {
		nestSessionJobs.delete(jobKey);
	});
	return job;
}

/** Send one text prompt into a session (queue mode, like the composer). */
async function nestSendPrompt(sessionId, text) {
	const request = {
		requestId: nestRequestId(),
		sessionId,
		mode: 'queue',
		content: [{ type: 'text', text }]
	};
	const zone = nestClientTimeZone();
	if (zone !== undefined) request.clientTimeZone = zone;
	const result = await nestClientContext.remote.session.prompt(request);
	nestUnwrapRemote(result, 'send prompt');
	return true;
}

/** Close one Remote stream handle, tolerating sync throws and async rejection. */
function nestDisposeStream(handle) {
	if (handle === null || handle === undefined) return;
	try {
		if (typeof handle.dispose !== 'function') return;
		const result = handle.dispose();
		if (result !== null && result !== undefined && typeof result.catch === 'function') result.catch(function () {});
	} catch (_error) {
		/* the carrier already closed */
	}
}

/** Open one managed session in the ordinary conversation view. */
function nestOpenSession(sessionId) {
	if (sessionId === null) return;
	try {
		nestClientContext.uiWorkspace.openSession(sessionId);
	} catch (_error) {
		/* navigation is best-effort */
	}
}
// #endregion

// #region chat folding
/** Add one live-chunk / surface envelope to an entry list without losing order. */
function nestAppendEntry(entries, entry) {
	const event = entry !== null && entry !== undefined ? entry.event : null;
	if (event === null || event === undefined) return entries;
	if (entry.type === 'transient') {
		// Live chunks are keyed by attempt + index; a replayed chunk must not be
		// appended twice (that would duplicate streamed assistant text).
		const data = event.data !== null && typeof event.data === 'object' ? event.data : null;
		const attemptId = data !== null && typeof data.attemptId === 'string' ? data.attemptId : '';
		if (attemptId !== '' && typeof event.seq === 'number') {
			for (let index = entries.length - 1; index >= 0; index -= 1) {
				const candidate = entries[index];
				if (candidate === null || candidate === undefined || candidate.type !== 'transient') continue;
				const candidateData = candidate.event !== null && candidate.event !== undefined && candidate.event.data !== null && typeof candidate.event.data === 'object' ? candidate.event.data : null;
				if (candidateData === null || candidate.event.type !== 'assistant/live-chunk') continue;
				if (candidateData.attemptId === attemptId && candidate.event.seq === event.seq) return entries;
			}
		}
		return entries.concat([entry]);
	}
	const last = entries.length > 0 ? entries[entries.length - 1] : null;
	const lastEvent = last !== null && last !== undefined ? last.event : null;
	const lastSeq = lastEvent !== null && lastEvent !== undefined && typeof lastEvent.seq === 'number' ? lastEvent.seq : -Infinity;
	const seq = typeof event.seq === 'number' ? event.seq : lastSeq + 1;
	// A durable event that is delivered twice (snapshot boundary + replayed
	// stream) must not produce two transcript rows.
	if (typeof event.seq === 'number') {
		for (const candidate of entries) {
			if (candidate !== null && candidate !== undefined && candidate.event !== null && candidate.event !== undefined && candidate.event.seq === event.seq) return entries;
		}
	}
	if (seq >= lastSeq) return entries.concat([entry]);
	const next = entries.slice();
	let index = next.length;
	while (index > 0) {
		const candidate = next[index - 1];
		const candidateSeq = candidate !== null && candidate !== undefined && candidate.event !== undefined && typeof candidate.event.seq === 'number' ? candidate.event.seq : -Infinity;
		if (candidateSeq <= seq) break;
		index -= 1;
	}
	next.splice(index, 0, entry);
	return next;
}

/** True when a surface event is an append (transcript must ignore replacements). */
function nestIsSurfaceAppend(event) {
	const op = event.surfaceOp;
	if (op === undefined || op === null) return true;
	return op === 'append';
}

/** Localizable turn failure descriptor from a `turn/end` reason. */
function nestTurnFailure(reason) {
	if (reason === null || typeof reason !== 'object') return null;
	if (reason.kind === 'error' && reason.error !== null && typeof reason.error === 'object') {
		return {
			message: typeof reason.error.message === 'string' ? reason.error.message : '',
			code: typeof reason.error.code === 'string' ? reason.error.code : ''
		};
	}
	if (reason.kind === 'aborted' && reason.reason !== null && typeof reason.reason === 'object'
		&& reason.reason.kind === 'hook' && reason.reason.reason === 'deepseek-account/signed-out') {
		return { message: '', code: 'ACCOUNT_SIGNED_OUT' };
	}
	if (reason.kind === 'interrupted') return { message: '', code: 'INTERRUPTED' };
	return null;
}

/** Append one text delta to a live assistant draft. */
function nestApplyTextChunk(draft, chunk) {
	if (chunk === null || typeof chunk !== 'object') return;
	if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
		draft.text += chunk.text;
	} else if (chunk.type === 'block-end' && chunk.block !== null && chunk.block !== undefined
		&& chunk.block.type === 'text' && typeof chunk.block.text === 'string' && draft.text === '') {
		draft.text = chunk.block.text;
	}
}

/**
 * Fold session entries into transcript rows.
 * Rows: {kind:'user'|'setup'|'assistant'|'tool'|'error'|'notice', ...}
 */
function nestFoldEntries(entries) {
	const rows = [];
	const drafts = new Map();
	const calls = new Map();
	const seenSeq = new Set();
	const assistantIds = new Set();
	const durableAssistantTexts = [];
	if (!Array.isArray(entries)) return rows;
	for (const entry of entries) {
		if (entry === null || entry === undefined) continue;
		const event = entry.event;
		if (event === null || event === undefined) continue;
		const data = event.data !== null && typeof event.data === 'object' ? event.data : {};
		const type = event.type;
		if (entry.type !== 'transient' && typeof event.seq === 'number') {
			if (seenSeq.has(event.seq)) continue;
			seenSeq.add(event.seq);
		}
		if (type === 'assistant/live-chunk') {
			const attemptId = typeof data.attemptId === 'string' ? data.attemptId : '';
			if (attemptId === '') continue;
			let draft = drafts.get(attemptId);
			if (draft === undefined) {
				draft = { attemptId, turn: -1, step: -1, text: '', time: event.time };
				drafts.set(attemptId, draft);
			}
			if (typeof data.turn === 'number') draft.turn = data.turn;
			if (typeof data.step === 'number') draft.step = data.step;
			nestApplyTextChunk(draft, data.chunk);
			continue;
		}
		if (entry.type === 'transient') continue;
		switch (type) {
			case 'user/message': {
				if (!nestIsSurfaceAppend(event)) break;
				const source = data.source !== null && typeof data.source === 'object' ? data.source : null;
				if (source === null || source.kind !== 'user') break;
				const text = nestTextOf(data.content);
				if (text === '') break;
				const isSetup = text.indexOf(NEST_SETUP_MARK) === 0;
				rows.push({
					kind: isSetup ? 'setup' : 'user',
					key: 'u' + String(event.seq),
					text,
					time: event.time,
					messageId: data.id
				});
				break;
			}
			case 'assistant/message': {
				if (!nestIsSurfaceAppend(event)) break;
				const turn = typeof data.turn === 'number' ? data.turn : -1;
				const step = typeof data.step === 'number' ? data.step : -1;
				const message = data.message !== null && typeof data.message === 'object' ? data.message : data;
				const text = nestTextOf(message !== null && message !== undefined ? message.content : undefined);
				/* The final message supersedes its streaming draft. Match by turn/step
				   and, as a safety net, by content when the chunk metadata was lost
				   (e.g. the stream was joined mid-turn and turn/step stayed -1). */
				for (const [attemptId, draft] of Array.from(drafts.entries())) {
					if (draft.turn === turn && draft.step === step) {
						drafts.delete(attemptId);
						continue;
					}
					const draftText = String(draft.text === undefined ? '' : draft.text).trim();
					if (text !== '' && draftText !== '' && draftText.length >= 8 && text.indexOf(draftText) === 0) drafts.delete(attemptId);
				}
				if (text !== '') {
					const messageId = message !== null && message !== undefined && typeof message.id === 'string' ? message.id : null;
					const duplicate = messageId !== null ? assistantIds.has(messageId) : rows.some((row) => row.kind === 'assistant' && row.text === text);
					if (messageId !== null) assistantIds.add(messageId);
					if (duplicate) break;
					durableAssistantTexts.push(text.trim());
					rows.push({
						kind: 'assistant',
						key: 'a' + String(event.seq),
						text,
						time: event.time,
						messageId: message !== null && message !== undefined ? message.id : undefined
					});
				}
				if (data.interrupted === true) {
					rows.push({ kind: 'notice', key: 'ni' + String(event.seq), notice: 'interrupted', time: event.time });
				}
				break;
			}
			case 'tool/call': {
				const callId = typeof data.callId === 'string' ? data.callId : '';
				const name = typeof data.name === 'string' ? data.name : 'tool';
				const args = typeof data.arguments === 'string' ? data.arguments : '';
				rows.push({ kind: 'tool', key: 't' + String(event.seq), callId, name, args, result: null, isError: false, time: event.time });
				if (callId !== '') calls.set(callId, rows.length - 1);
				break;
			}
			case 'tool/result': {
				if (!nestIsSurfaceAppend(event)) break;
				const message = data.message !== null && typeof data.message === 'object' ? data.message : {};
				const source = message.source !== null && typeof message.source === 'object' ? message.source : null;
				const callId = source !== null && typeof source.callId === 'string' ? source.callId : '';
				const resultText = nestTextOf(message.content);
				const isError = message.isError === true || (data.error !== undefined && data.error !== null);
				const rowIndex = callId !== '' ? calls.get(callId) : undefined;
				if (rowIndex !== undefined && rows[rowIndex] !== undefined) {
					rows[rowIndex] = Object.assign({}, rows[rowIndex], { result: resultText, isError, resultTime: event.time });
				} else {
					rows.push({
						kind: 'tool',
						key: 'tr' + String(event.seq),
						callId,
						name: typeof data.name === 'string' ? data.name : 'tool',
						args: '',
						result: resultText,
						isError,
						time: event.time
					});
				}
				break;
			}
			case 'turn/end': {
				const reason = data.reason !== null && typeof data.reason === 'object' ? data.reason : {};
				const failure = nestTurnFailure(reason);
				if (failure !== null) {
					rows.push({ kind: 'error', key: 'e' + String(event.seq), detail: failure.message, code: failure.code, time: event.time });
				}
				if (reason.kind === 'max-tokens') {
					rows.push({ kind: 'notice', key: 'nm' + String(event.seq), notice: 'maxTokens', time: event.time });
				}
				drafts.clear();
				break;
			}
			case 'compaction/summary': {
				rows.push({ kind: 'notice', key: 'nc' + String(event.seq), notice: 'compacted', time: event.time });
				break;
			}
			default:
				break;
		}
	}
	const live = Array.from(drafts.values()).filter((draft) => draft.text !== '');
	live.sort((left, right) => (left.turn - right.turn) || (left.step - right.step));
	const renderedLive = new Set();
	for (const draft of live) {
		const draftText = String(draft.text === undefined ? '' : draft.text).trim();
		if (draftText === '' || renderedLive.has(draftText)) continue;
		const covered = durableAssistantTexts.some((durableText) => durableText === draftText
			|| (draftText.length >= 12 && durableText.length > draftText.length && durableText.indexOf(draftText) === 0));
		if (covered) continue;
		renderedLive.add(draftText);
		rows.push({ kind: 'assistant', key: 'live-' + draft.attemptId, text: draft.text, time: draft.time, streaming: true });
	}
	return rows;
}
// #endregion

// #region chat hooks
/**
 * Live transcript for the coach session: opening snapshot from `follow`,
 * durable appends, streaming assistant chunks, and running state.
 */
function nestUseSessionChat(sessionId) {
	const [entries, setEntries] = React.useState(NEST_EMPTY);
	const [phase, setPhase] = React.useState(sessionId === null ? 'idle' : 'loading');
	const [error, setError] = React.useState(null);
	const [running, setRunning] = React.useState(false);
	const [reloadToken, setReloadToken] = React.useState(0);
	const attemptsRef = React.useRef(new Map());

	React.useEffect(() => {
		if (sessionId === null) {
			setEntries(NEST_EMPTY);
			setPhase('idle');
			setRunning(false);
			return undefined;
		}
		let alive = true;
		let follow = null;
		const controller = new AbortController();
		const attempts = new Map();
		attemptsRef.current = attempts;
		setEntries(NEST_EMPTY);
		setError(null);
		setRunning(false);
		setPhase('loading');
		try {
			follow = nestClientContext.remote.session.follow({
				address: { kind: 'session', sessionId },
				activate: true,
				assistantStream: true,
				maxMessages: NEST_FOLLOW_WINDOW.maxMessages,
				turnWindow: NEST_FOLLOW_WINDOW.turnWindow
			}, controller.signal);
		} catch (caught) {
			setPhase('error');
			setError(nestErrorMessage(caught));
			return undefined;
		}
		(async () => {
			try {
				for await (const frame of follow) {
					if (!alive) return;
					if (frame === null || typeof frame !== 'object') continue;
					if (frame.type === 'snapshot') {
						setEntries(Array.isArray(frame.records) ? frame.records : NEST_EMPTY);
						setPhase('ready');
						const baseline = frame.assistantStream;
						const active = baseline !== null && baseline !== undefined ? baseline.activeAttempt : null;
						if (active !== null && active !== undefined && typeof active.attemptId === 'string') {
							attempts.set(active.attemptId, { turn: active.turn, step: active.step });
						}
						continue;
					}
					if (frame.type === 'event') {
						setEntries((previous) => nestAppendEntry(previous, { type: 'event', event: frame.event }));
						setPhase('ready');
						continue;
					}
					if (frame.type === 'assistant-stream') {
						const streamFrame = frame.frame;
						if (streamFrame === null || streamFrame === undefined) continue;
						if (streamFrame.type === 'start' && typeof streamFrame.attemptId === 'string') {
							attempts.set(streamFrame.attemptId, { turn: streamFrame.turn, step: streamFrame.step });
							continue;
						}
						if (streamFrame.type === 'chunk' && typeof streamFrame.attemptId === 'string') {
							const meta = attempts.get(streamFrame.attemptId) || { turn: -1, step: -1 };
							const index = typeof streamFrame.index === 'number' ? streamFrame.index : 0;
							setEntries((previous) => nestAppendEntry(previous, {
								type: 'transient',
								event: {
									type: 'assistant/live-chunk',
									seq: index,
									time: streamFrame.time,
									data: {
										attemptId: streamFrame.attemptId,
										turn: meta.turn,
										step: meta.step,
										chunk: streamFrame.chunk
									}
								}
							}));
						}
					}
				}
			} catch (caught) {
				if (!alive || controller.signal.aborted) return;
				setPhase('error');
				setError(nestErrorMessage(caught));
			}
		})();
		return () => {
			alive = false;
			controller.abort();
			nestDisposeStream(follow);
		};
	}, [sessionId, reloadToken]);

	React.useEffect(() => {
		if (sessionId === null) return undefined;
		let alive = true;
		let handle = null;
		const controller = new AbortController();
		try {
			handle = nestClientContext.remote.session.observeState({ sessionId }, controller.signal);
		} catch (_error) {
			return undefined;
		}
		(async () => {
			try {
				for await (const state of handle) {
					if (!alive) return;
					if (state !== null && typeof state === 'object') setRunning(state.running === true);
				}
			} catch (_error) {
				/* state is an enhancement; ignore carrier failures */
			}
		})();
		return () => {
			alive = false;
			controller.abort();
			nestDisposeStream(handle);
		};
	}, [sessionId]);

	const rows = React.useMemo(() => nestFoldEntries(entries), [entries]);
	const reload = React.useCallback(() => setReloadToken((value) => value + 1), []);
	return { rows, phase, error, running, reload };
}

/**
 * The coach session for one workspace. Creates/seeds it lazily — only while
 * `active` (the playground tab is open) — so merely opening the panel never
 * starts a model turn. Exposes `newRound` for "start over".
 */
function nestUsePaneSession(workspaceId, t, active) {
	const [sessionId, setSessionId] = React.useState(null);
	const [phase, setPhase] = React.useState(() => {
		if (workspaceId === null) return 'waiting';
		return active === true ? 'creating' : 'idle';
	});
	const [error, setError] = React.useState(null);
	const [generation, setGeneration] = React.useState(0);

	React.useEffect(() => {
		if (workspaceId === null || active !== true) {
			setSessionId(null);
			setPhase(workspaceId === null ? 'waiting' : 'idle');
			setError(null);
			return undefined;
		}
		let alive = true;
		setPhase('creating');
		setError(null);
		nestEnsureSession(workspaceId, t).then((id) => {
			if (!alive) return;
			setSessionId(id);
			setPhase('ready');
		}, (caught) => {
			if (!alive) return;
			setSessionId(null);
			setPhase('error');
			setError(nestErrorMessage(caught));
		});
		return () => {
			alive = false;
		};
	}, [workspaceId, generation, active]);

	const newRound = React.useCallback(() => {
		if (workspaceId === null) return;
		nestForgetSessionId(workspaceId);
		setSessionId(null);
		setPhase('creating');
		setGeneration((value) => value + 1);
	}, [workspaceId]);

	return { sessionId, phase, error, newRound };
}
// #endregion

// #region chat pane
/** Localized text for one turn-failure code. */
function nestFailureText(t, row) {
	if (row.code === 'ACCOUNT_SIGNED_OUT') return t('chat.accountSignedOut');
	if (row.code === 'INTERRUPTED') return t('chat.turnInterrupted');
	const detail = typeof row.detail === 'string' ? row.detail : '';
	return detail !== '' ? detail : t('chat.turnFailed');
}

/** One transcript row of the coach pane. */
function NestChatRow(props) {
	const row = props.row;
	const t = props.t;
	if (row === null || row === undefined) return null;
	if (row.kind === 'setup') {
		return h('details', { className: 'ne-setupRow', key: row.key },
			h('summary', { className: 'ne-setupSummary' }, NestGlyph({ name: 'info', size: 13 }), h('span', null, t('chat.setupLabel'))),
			h('p', { className: 'ne-setupText' }, row.text)
		);
	}
	if (row.kind === 'user') {
		return h('article', { className: 'ne-msg ne-msgUser', key: row.key },
			h('div', { className: 'ne-msgMeta' },
				h('span', { className: 'ne-msgWho' }, t('chat.you')),
				row.time !== undefined ? h('time', { className: 'ne-msgTime' }, nestTimeLabel(row.time)) : null
			),
			h('div', { className: 'ne-bubble ne-bubbleUser' }, nestRenderRichText(row.text))
		);
	}
	if (row.kind === 'assistant') {
		return h('article', { className: 'ne-msg ne-msgAi', key: row.key },
			h('div', { className: 'ne-msgMeta' },
				h('span', { className: 'ne-aiBadge' }, NestPanelIcon({ size: 13 })),
				h('span', { className: 'ne-msgWho' }, t('chat.title')),
				row.time !== undefined ? h('time', { className: 'ne-msgTime' }, nestTimeLabel(row.time)) : null
			),
			h('div', { className: 'ne-bubble ne-bubbleAi' },
				nestRenderRichText(row.text),
				row.streaming === true ? h('span', { className: 'ne-caret', 'aria-hidden': true }) : null
			)
		);
	}
	if (row.kind === 'tool') {
		const failed = row.isError === true;
		const summary = h('summary', { className: 'ne-toolSummary' },
			NestGlyph({ name: 'terminal', size: 13 }),
			h('span', null, t('chat.toolCall')),
			h('code', { className: 'ne-toolName' }, row.name),
			failed ? h('span', { className: 'ne-toolState' }, t('chat.toolFailed')) : null
		);
		const body = [];
		if (typeof row.args === 'string' && row.args !== '') {
			body.push(h('pre', { className: 'ne-toolPre', key: 'args' }, nestClipText(row.args, 1200)));
		}
		if (typeof row.result === 'string' && row.result !== '') {
			body.push(h('pre', { className: 'ne-toolPre', key: 'result' }, nestClipText(row.result, 1600)));
		}
		return h('details', { className: 'ne-toolRow', key: row.key, 'data-error': failed ? 'true' : undefined }, summary, body.length > 0 ? body : null);
	}
	if (row.kind === 'error') {
		return h('div', { className: 'ne-rowError', key: row.key, role: 'status' },
			NestGlyph({ name: 'alert', size: 13 }),
			h('span', null, t('chat.turnFailed') + ' · ' + nestFailureText(t, row))
		);
	}
	if (row.kind === 'notice') {
		let text = '';
		if (row.notice === 'maxTokens') text = t('chat.maxTokens');
		else if (row.notice === 'compacted') text = t('chat.compacted');
		else if (row.notice === 'interrupted') text = t('chat.turnInterrupted');
		if (text === '') return null;
		return h('div', { className: 'ne-rowNotice', key: row.key }, NestGlyph({ name: 'info', size: 12 }), h('span', null, text));
	}
	return null;
}

/**
 * The coach pane: header, transcript and composer. `pendingPrompt` carries a
 * queued prompt from another tab ({ id, text }); the pane sends it once the
 * session is ready and calls `onPromptSent(id)`.
 */
function NestChatPane(props) {
	const t = props.t;
	const pane = props.pane;
	const pendingPrompt = props.pendingPrompt;
	const onPromptSent = props.onPromptSent;
	const chat = nestUseSessionChat(pane.sessionId);
	const [draft, setDraft] = React.useState('');
	const [sending, setSending] = React.useState(false);
	const [notice, setNotice] = React.useState(null);
	const listRef = React.useRef(null);
	const stickRef = React.useRef(true);
	const sentRef = React.useRef(new Set());

	React.useEffect(() => {
		if (!stickRef.current) return;
		const node = listRef.current;
		if (node !== null) node.scrollTop = node.scrollHeight;
	}, [chat.rows, chat.running]);

	React.useEffect(() => {
		if (pendingPrompt === null || pendingPrompt === undefined) return;
		if (sentRef.current.has(pendingPrompt.id)) return;
		if (pane.phase !== 'ready' || pane.sessionId === null) return;
		sentRef.current.add(pendingPrompt.id);
		(async () => {
			try {
				await nestSendPrompt(pane.sessionId, pendingPrompt.text);
			} catch (error) {
				setNotice({ tone: 'error', text: t('chat.sendFailed') + nestErrorMessage(error) });
			} finally {
				if (typeof onPromptSent === 'function') onPromptSent(pendingPrompt.id);
			}
		})();
	}, [pendingPrompt, pane.phase, pane.sessionId]);

	const onScroll = () => {
		const node = listRef.current;
		if (node === null) return;
		stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90;
	};

	const ready = pane.phase === 'ready' && pane.sessionId !== null;
	const canSend = ready && !sending;

	const send = async () => {
		const text = draft.trim();
		if (text === '' || !canSend) return;
		setDraft('');
		setSending(true);
		setNotice(null);
		try {
			await nestSendPrompt(pane.sessionId, text);
		} catch (error) {
			setDraft(text);
			setNotice({ tone: 'error', text: t('chat.sendFailed') + nestErrorMessage(error) });
		} finally {
			setSending(false);
		}
	};

	const onKeyDown = (event) => {
		if (event.key !== 'Enter' || event.shiftKey) return;
		const native = event.nativeEvent;
		if (native !== null && native !== undefined && (native.isComposing === true || native.keyCode === 229)) return;
		event.preventDefault();
		send();
	};

	const hasStreaming = chat.rows.some((row) => row.kind === 'assistant' && row.streaming === true);
	let body = null;
	if (pane.phase === 'creating') {
		body = h('div', { className: 'ne-paneState' }, NestSpinner({}), h('span', null, t('chat.creating')));
	} else if (pane.phase === 'error') {
		body = h('div', { className: 'ne-paneState ne-paneStateError' },
			h('p', null, t('chat.sessionError') + (pane.error === null ? '' : pane.error)),
			h('button', { className: 'ne-btn ne-btnGhost', type: 'button', onClick: pane.newRound }, t('chat.retry'))
		);
	} else if (pane.phase === 'waiting') {
		body = h('div', { className: 'ne-paneState' },
			NestGlyph({ name: 'compass', size: 22 }),
			h('p', null, t('workspace.empty')),
			h('p', { className: 'ne-muted' }, t('workspace.emptyHint'))
		);
	} else if (chat.phase === 'loading' && chat.rows.length === 0) {
		body = h('div', { className: 'ne-paneState' }, NestSpinner({}), h('span', null, t('chat.loading')));
	} else {
		const rows = chat.rows.map((row) => h(NestChatRow, { key: row.key, row, t }));
		const empty = chat.rows.length === 0 && chat.phase === 'ready';
		body = h('div', { className: 'ne-paneBody' },
			chat.error !== null
				? h('div', { className: 'ne-paneBanner' },
					h('span', null, t('chat.errorPrefix') + chat.error),
					h('button', { className: 'ne-btn ne-btnGhost ne-btnSmall', type: 'button', onClick: chat.reload }, t('chat.retry')))
				: null,
			empty
				? h('div', { className: 'ne-paneEmpty' }, NestPanelIcon({ size: 24 }), h('p', null, t('chat.empty')))
				: null,
			h('div', { className: 'ne-transcript', ref: listRef, onScroll, role: 'log', 'aria-live': 'polite' },
				rows,
				chat.running && chat.phase === 'ready' && !hasStreaming
					? h('div', { className: 'ne-typing' },
						h('span', { className: 'ne-typingDots' }, h('i', null), h('i', null), h('i', null)),
						h('span', { className: 'ne-typingText' }, t('chat.typing')))
					: null
			)
		);
	}

	return h('section', { className: 'ne-chatPane', 'aria-label': t('chat.title') },
		h('header', { className: 'ne-chatPaneHead' },
			h('div', { className: 'ne-chatIdentity' },
				h('span', { className: 'ne-chatDot', 'data-state': chat.running ? 'running' : 'idle' }),
				h('div', { className: 'ne-chatText' },
					h('h3', { className: 'ne-chatTitle' }, t('chat.title')),
					h('p', { className: 'ne-chatDesc' }, t('chat.desc'))
				)
			),
			h('div', { className: 'ne-chatActions' },
				pane.sessionId !== null
					? h('button', {
						className: 'ne-iconBtn',
						type: 'button',
						title: t('chat.openConversation'),
						'aria-label': t('chat.openConversation'),
						onClick: () => nestOpenSession(pane.sessionId)
					}, NestGlyph({ name: 'external', size: 15 }))
					: null,
				h('button', {
					className: 'ne-iconBtn',
					type: 'button',
					title: t('chat.newRound'),
					'aria-label': t('chat.newRound'),
					disabled: pane.phase === 'creating',
					onClick: pane.newRound
				}, NestGlyph({ name: 'refresh', size: 15 }))
			)
		),
		body,
		h('footer', { className: 'ne-composer' },
			notice !== null ? h('p', { className: 'ne-composerNotice', 'data-tone': notice.tone }, notice.text) : null,
			h('div', { className: 'ne-composerRow' },
				h('textarea', {
					className: 'ne-composerInput',
					rows: Math.min(5, Math.max(1, draft.split('\n').length)),
					value: draft,
					placeholder: t('chat.placeholder'),
					'aria-label': t('chat.placeholder'),
					disabled: !ready,
					onChange: (event) => setDraft(event.target.value),
					onKeyDown
				}),
				h('button', {
					className: 'ne-sendBtn',
					type: 'button',
					disabled: !canSend || draft.trim() === '',
					title: t('chat.send'),
					'aria-label': t('chat.send'),
					onClick: send
				}, sending ? NestSpinner({ onBrand: true }) : NestGlyph({ name: 'send' }))
			),
			h('p', { className: 'ne-composerHint' }, t('chat.hint'))
		)
	);
}
// #endregion
