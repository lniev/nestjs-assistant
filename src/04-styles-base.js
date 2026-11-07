// #region base styles
// Shared chrome for the NestJS Assistant panel: page layout, header, tabs,
// buttons, chips, transcript rows and the coach composer. View-specific styles
// live in src/styles/*.js and only add their own prefixed rules.
// Only host theme tokens are used as colors; literal colors never appear here.

const NEST_CSS_BASE = `
.ne-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.55;
  overflow: hidden;
}
.ne-page *, .ne-page *::before, .ne-page *::after { box-sizing: border-box; }
:where(.ne-page) button, :where(.ne-page) input, :where(.ne-page) textarea, :where(.ne-page) select {
  font-family: inherit; color: inherit;
}
.ne-page code, .ne-page pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

.ne-header {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 11px 22px 10px;
  flex: none;
  background:
    radial-gradient(ellipse at 4% 0%, color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent), transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-layer-1) 58%, transparent), transparent);
}
.ne-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
.ne-brandMark {
  width: 38px; height: 38px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 12px;
  color: var(--dsw-alias-brand-primary);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, var(--dsw-alias-bg-layer-1)), var(--dsw-alias-bg-layer-1));
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.ne-brandText { min-width: 0; }
.ne-title { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: 0.1px; line-height: 1.35; }
.ne-subtitle { margin: 2px 0 0; font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ne-headerEnd { margin-left: auto; display: flex; align-items: center; gap: 9px; flex: none; }
.ne-eyebrow { display: inline-block; margin-bottom: 6px; font-size: 9.5px; font-weight: 700; letter-spacing: 1.3px; color: var(--dsw-alias-brand-primary); opacity: 0.85; text-transform: uppercase; }

.ne-wsField { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ne-wsSelect {
  max-width: 190px; min-height: 29px; padding: 5px 8px; border-radius: 8px; font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.ne-wsSelect:focus { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l1)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); }
.ne-statChip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 999px; font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 72%, transparent);
}
.ne-statChip .ne-glyph { color: var(--dsw-alias-brand-primary); }

.ne-tabs {
  display: flex; gap: 4px; padding: 0 20px;
  border-bottom: 1px solid var(--dsw-alias-border-l1); flex: none;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 28%, transparent);
}
.ne-tab {
  position: relative;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 14px 10px; border: none; background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-secondary); font-size: 12.5px;
  border-radius: 8px 8px 0 0;
  transition: color 140ms ease, background 140ms ease;
}
.ne-tab::after {
  content: ''; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px;
  border-radius: 2px 2px 0 0; background: transparent;
}
.ne-tab:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.ne-tab[aria-selected="true"] {
  color: var(--dsw-alias-brand-primary); font-weight: 650;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent);
}
.ne-tab[aria-selected="true"]::after { background: var(--dsw-alias-brand-primary); }
.ne-tab:focus-visible, .ne-btn:focus-visible, .ne-iconBtn:focus-visible, .ne-linkBtn:focus-visible {
  outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 20%, transparent);
}

.ne-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.ne-scroll { overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; }
.ne-scroll::-webkit-scrollbar, .ne-transcript::-webkit-scrollbar, .ne-codeScroll::-webkit-scrollbar { width: 9px; height: 9px; }
.ne-scroll::-webkit-scrollbar-track, .ne-transcript::-webkit-scrollbar-track { background: transparent; }
.ne-scroll::-webkit-scrollbar-thumb, .ne-transcript::-webkit-scrollbar-thumb, .ne-codeScroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 24%, transparent);
  border-radius: 999px; border: 2px solid transparent; background-clip: content-box;
}
.ne-scroll::-webkit-scrollbar-thumb:hover, .ne-transcript::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--dsw-alias-label-secondary) 40%, transparent); background-clip: content-box; }
.ne-muted { color: var(--dsw-alias-label-secondary); }
.ne-empty { padding: 34px 18px; text-align: center; color: var(--dsw-alias-label-secondary); display: flex; flex-direction: column; align-items: center; gap: 10px; }

.ne-input, .ne-select {
  min-height: 30px; padding: 6px 9px; border-radius: 8px; font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary); outline: none; min-width: 0;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.ne-input:hover, .ne-select:hover { border-color: var(--dsw-alias-border-l2); }
.ne-input:focus, .ne-select:focus {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l1));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent);
}
.ne-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 30px; padding: 5px 11px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); font-size: 12px;
  transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease, transform 120ms ease, box-shadow 120ms ease;
  white-space: nowrap;
}
.ne-btn:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
.ne-btn:active:not(:disabled) { transform: translateY(1px); }
.ne-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ne-btnPrimary { background: var(--dsw-alias-brand-primary); border-color: transparent; color: var(--dsw-alias-bg-base); font-weight: 650; box-shadow: 0 2px 8px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); }
.ne-btnPrimary:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 86%, var(--dsw-alias-label-primary)); box-shadow: 0 3px 12px color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent); }
.ne-btnGhost { background: transparent; }
.ne-btnGhost:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ne-btnSmall { padding: 4px 8px; font-size: 11.5px; border-radius: 7px; }
.ne-btnDanger { color: var(--dsw-alias-state-error-primary); }
.ne-linkBtn { border: none; background: none; padding: 0; color: var(--dsw-alias-brand-primary); cursor: pointer; font-size: 12px; }
.ne-linkBtn:hover { text-decoration: underline; }
.ne-iconBtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 7px; cursor: pointer;
  border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary);
  transition: background 120ms ease, color 120ms ease;
}
.ne-iconBtn:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent); color: var(--dsw-alias-label-primary); }
.ne-iconBtn:active { background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent); }
.ne-iconBtn:disabled { opacity: 0.4; cursor: not-allowed; }

.ne-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 999px; font-size: 10.5px;
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-1);
  white-space: nowrap; line-height: 1.6;
}
.ne-chipSoft { border-color: transparent; background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ne-chipBrand { color: var(--dsw-alias-brand-primary); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }
.ne-pillRow { display: flex; flex-wrap: wrap; gap: 6px; }

.ne-sectionTitle { margin: 0; font-size: 13.5px; font-weight: 650; }
.ne-sectionHead { display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px 12px; flex: none; }
.ne-sectionHeading { min-width: 0; }
.ne-sectionIntro { margin: 4px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; max-width: 780px; }

.ne-spinner {
  width: 14px; height: 14px; flex: none; display: inline-block;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent);
  border-top-color: var(--dsw-alias-label-secondary);
  animation: ne-spin 0.8s linear infinite;
}
.ne-spinnerOnBrand { border-color: color-mix(in srgb, var(--dsw-alias-bg-base) 35%, transparent); border-top-color: var(--dsw-alias-bg-base); }
@keyframes ne-spin { to { transform: rotate(360deg); } }

.ne-statusPill { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.ne-statusDot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); flex: none; }
.ne-statusPill[data-tone="running"] .ne-statusDot { background: var(--dsw-alias-state-success-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 18%, transparent); animation: ne-pulse 1.6s ease-in-out infinite; }
.ne-statusPill[data-tone="error"] .ne-statusDot { background: var(--dsw-alias-state-error-primary); }
.ne-statusPill[data-tone="warn"] .ne-statusDot { background: var(--dsw-alias-state-warn-primary); }
@keyframes ne-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }

.ne-toast {
  position: absolute; right: 20px; bottom: 18px; max-width: 460px;
  padding: 9px 13px; border-radius: 9px; font-size: 12px; z-index: 20;
  background: var(--dsw-alias-bg-overlay);
  border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);
}
.ne-toast[data-tone="error"] { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent); color: var(--dsw-alias-state-error-primary); }

.ne-inlineCode {
  padding: 1px 5px; border-radius: 5px; font-size: 0.92em;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
}
.ne-inlineLink { color: var(--dsw-alias-brand-primary); text-decoration: none; }
.ne-inlineLink:hover { text-decoration: underline; }
.ne-richPara { margin: 0 0 9px; }
.ne-richHead { margin: 14px 0 7px; font-size: 13.5px; }
.ne-richList { margin: 0 0 10px; padding-left: 20px; }
.ne-richList li { margin: 2px 0; }
.ne-richQuote { margin: 0 0 10px; padding: 2px 12px; border-left: 2px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }
.ne-richCode {
  margin: 0 0 10px; padding: 10px 12px; border-radius: 8px; overflow-x: auto;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  font-size: 11.5px; line-height: 1.5;
}

/* ---- rendered markdown: One Dark code blocks, tables, rules ---- */
.ne-oneDark {
  --ne-od-bg: #282c34;
  --ne-od-bg-deep: #21252b;
  --ne-od-border: #181a1f;
  --ne-od-fg: #abb2bf;
  --ne-od-muted: #7f848e;
  --ne-od-comment: #5c6370;
  --ne-od-gutter: #4b5263;
  --ne-od-purple: #c678dd;
  --ne-od-green: #98c379;
  --ne-od-orange: #d19a66;
  --ne-od-yellow: #e5c07b;
  --ne-od-blue: #61afef;
  --ne-od-red: #e06c75;
  --ne-od-cyan: #56b6c2;
}
.ne-mdCode {
  margin: 0 0 10px; border: 1px solid var(--ne-od-border); border-radius: 9px; overflow: hidden;
  background: var(--ne-od-bg); color: var(--ne-od-fg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px; line-height: 1.6;
}
.ne-mdCodeHead {
  display: flex; align-items: center; gap: 8px; min-height: 24px; padding: 3px 10px;
  background: var(--ne-od-bg-deep); border-bottom: 1px solid var(--ne-od-border);
  color: var(--ne-od-muted); font-size: 10px; letter-spacing: 0.3px;
}
.ne-mdCodeDots { display: inline-flex; align-items: center; gap: 4px; flex: none; }
.ne-mdCodeDots i { width: 7px; height: 7px; border-radius: 50%; background: #4b5263; display: block; }
.ne-mdCodeDots i:first-child { background: #e06c75; }
.ne-mdCodeDots i:nth-child(2) { background: #e5c07b; }
.ne-mdCodeDots i:nth-child(3) { background: #98c379; }
.ne-mdCodeLang { margin-left: auto; color: var(--ne-od-green); font-weight: 700; text-transform: uppercase; font-size: 9.5px; }
.ne-mdCodePre { margin: 0; padding: 9px 12px; overflow-x: auto; white-space: pre; tab-size: 2; color: var(--ne-od-fg); }
.ne-mdTokLine { display: block; min-height: 1.6em; }
.ne-mdTokKw { color: var(--ne-od-purple); font-weight: 600; }
.ne-mdTokStr { color: var(--ne-od-green); }
.ne-mdTokCom { color: var(--ne-od-comment); font-style: italic; }
.ne-mdTokDec { color: var(--ne-od-yellow); }
.ne-mdTokNum { color: var(--ne-od-orange); }
.ne-mdTokFn { color: var(--ne-od-blue); }
.ne-mdTokType { color: var(--ne-od-yellow); }
.ne-inlineDel { color: var(--dsw-alias-label-secondary); text-decoration: line-through; }
.ne-mdHr { margin: 12px 0; border: none; border-top: 1px solid var(--dsw-alias-border-l2); }
.ne-mdTableWrap { margin: 0 0 10px; overflow-x: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; }
.ne-mdTable { border-collapse: collapse; width: 100%; font-size: 11.5px; }
.ne-mdTable th, .ne-mdTable td { padding: 5px 9px; border-bottom: 1px solid var(--dsw-alias-border-l1); text-align: left; vertical-align: top; }
.ne-mdTable th { background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); font-weight: 650; white-space: nowrap; color: var(--dsw-alias-label-primary); }
.ne-mdTable tr:last-child td { border-bottom: none; }

/* ---- coach chat pane (used inside the playground) ---- */
.ne-chatPane { display: flex; flex-direction: column; min-height: 0; min-width: 0; height: 100%; background: var(--dsw-alias-bg-base); }
.ne-chatPaneHead {
  display: flex; align-items: center; gap: 10px; flex: none;
  padding: 13px 14px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 3%, var(--dsw-alias-bg-base));
}
.ne-chatIdentity { display: flex; align-items: center; gap: 9px; min-width: 0; }
.ne-chatDot { width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); flex: none; }
.ne-chatDot[data-state="running"] { background: var(--dsw-alias-state-success-primary); animation: ne-pulse 1.6s ease-in-out infinite; }
.ne-chatText { min-width: 0; }
.ne-chatTitle { margin: 0; font-size: 13px; font-weight: 650; }
.ne-chatDesc { margin: 0; font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ne-chatActions { margin-left: auto; display: flex; gap: 2px; }
.ne-chatPane .ne-paneBody, .ne-paneBody { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.ne-transcript { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 14px 18px; display: flex; flex-direction: column; gap: 12px; }
.ne-paneState { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; color: var(--dsw-alias-label-secondary); text-align: center; padding: 24px; font-size: 12.5px; }
.ne-paneStateError { color: var(--dsw-alias-state-error-primary); }
.ne-paneEmpty { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--dsw-alias-label-secondary); padding: 22px 12px; text-align: center; }
.ne-paneBanner {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin: 8px 14px 0; padding: 7px 10px; border-radius: 8px; font-size: 11.5px;
  color: var(--dsw-alias-state-warn-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 28%, transparent);
}
.ne-msg { display: flex; flex-direction: column; gap: 4px; }
.ne-msgMeta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.ne-msgWho { font-weight: 600; color: var(--dsw-alias-label-secondary); }
.ne-msgTime { margin-left: auto; font-variant-numeric: tabular-nums; }
.ne-aiBadge {
  display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;
  border-radius: 6px; color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.ne-bubble { padding: 9px 12px; border-radius: 12px; font-size: 12.5px; overflow-wrap: anywhere; line-height: 1.6; }
.ne-bubble > :last-child { margin-bottom: 0; }
.ne-bubbleUser { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, var(--dsw-alias-bg-layer-1)); border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); border-bottom-right-radius: 4px; align-self: flex-end; max-width: 88%; }
.ne-msgUser { align-items: flex-end; }
.ne-msgUser .ne-msgMeta { align-self: flex-end; }
.ne-bubbleAi { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-top-left-radius: 4px; box-shadow: 0 1px 3px color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.ne-setupRow { border: 1px dashed var(--dsw-alias-border-l2); border-radius: 8px; padding: 7px 10px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.ne-setupSummary { cursor: pointer; display: flex; align-items: center; gap: 6px; list-style: none; }
.ne-setupText { margin: 8px 0 0; white-space: pre-wrap; }
.ne-rowError {
  display: flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 8px; font-size: 11.5px;
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 25%, transparent);
}
.ne-rowNotice { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.ne-toolRow { border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); padding: 6px 9px; font-size: 11.5px; }
.ne-toolRow[data-error="true"] { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, transparent); }
.ne-toolSummary { display: flex; align-items: center; gap: 6px; cursor: pointer; list-style: none; color: var(--dsw-alias-label-secondary); }
.ne-toolName { color: var(--dsw-alias-brand-primary); font-size: 11px; }
.ne-toolState { color: var(--dsw-alias-state-error-primary); }
.ne-toolPre { margin: 7px 0 0; padding: 7px 9px; border-radius: 6px; overflow-x: auto; font-size: 11px; background: var(--dsw-alias-bg-layer-2); }
.ne-caret { display: inline-block; width: 2px; height: 12px; margin-left: 2px; vertical-align: -2px; background: var(--dsw-alias-brand-primary); animation: ne-blink 1s steps(2) infinite; }
@keyframes ne-blink { 50% { opacity: 0; } }
.ne-typing { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.ne-typingDots { display: inline-flex; gap: 3px; }
.ne-typingDots i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: ne-typing 1.2s ease-in-out infinite; }
.ne-typingDots i:nth-child(2) { animation-delay: 0.15s; }
.ne-typingDots i:nth-child(3) { animation-delay: 0.3s; }
@keyframes ne-typing { 0%,60%,100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }
.ne-composer { flex: none; padding: 10px 14px 11px; border-top: 1px solid var(--dsw-alias-border-l1); background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 42%, transparent); }
.ne-composerRow { display: flex; align-items: flex-end; gap: 8px; }
.ne-composerInput {
  flex: 1; resize: none; min-height: 36px; max-height: 140px; padding: 8px 10px;
  border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); outline: none; font-size: 12.5px; line-height: 1.5;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.ne-composerInput:focus { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l1)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }
.ne-sendBtn {
  width: 34px; height: 34px; flex: none; border-radius: 9px; border: none; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base);
}
.ne-sendBtn:disabled { opacity: 0.45; cursor: not-allowed; }
.ne-composerHint { margin: 6px 2px 0; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.ne-composerNotice { margin: 0 0 7px; font-size: 11.5px; color: var(--dsw-alias-state-error-primary); }

.ne-glyph { display: block; flex: none; }
.ne-loadingLine { display: flex; align-items: center; gap: 9px; padding: 22px; color: var(--dsw-alias-label-secondary); font-size: 12.5px; }
.ne-errorBox {
  margin: 18px 20px; padding: 12px 14px; border-radius: 10px; font-size: 12.5px;
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 25%, transparent);
  display: flex; flex-direction: column; gap: 8px; align-items: flex-start;
}

@media (max-width: 860px) {
  .ne-header { flex-wrap: wrap; min-height: 58px; padding: 9px 14px; }
  .ne-headerEnd { width: 100%; margin-left: 0; justify-content: flex-end; }
  .ne-subtitle { display: none; }
  .ne-tabs { padding: 0 10px; overflow-x: auto; }
  .ne-tab { padding: 8px 10px 9px; white-space: nowrap; }
}

@media (prefers-reduced-motion: reduce) {
  .ne-page *, .ne-page *::before, .ne-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;
// #endregion
