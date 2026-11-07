// #region playground styles
// Two-pane playground: coach chat on the left, sandbox files + editor + request
// console on the right. Colors come only from host theme tokens.

const NEST_CSS_PLAYGROUND = `
.nep-page { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; background: var(--dsw-alias-bg-base); }
.nep-split { flex: 1; min-height: 0; display: flex; }
.nep-left {
  width: 38%; min-width: 300px; max-width: 540px;
  border-right: 1px solid var(--dsw-alias-border-l1);
  display: flex; min-height: 0;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 18%, transparent);
}
.nep-left > * { flex: 1; min-width: 0; }
.nep-right { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }

/* ---- stage toolbar ---- */
.nep-toolbar {
  flex: none; display: flex; align-items: center; gap: 16px;
  min-height: 56px; padding: 9px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-layer-1) 55%, transparent), transparent);
}
.nep-toolbarText { min-width: 0; }
.nep-title { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.35; }
.nep-desc { margin: 2px 0 0; font-size: 10.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nep-toolbarActions { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: none; flex-wrap: wrap; justify-content: flex-end; }

/* ---- module bar (code modules + code versions) ---- */
.nep-modBar {
  flex: none; display: flex; flex-direction: column; gap: 6px;
  padding: 8px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 42%, transparent);
}
.nep-modRow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.nep-modField { display: flex; align-items: center; gap: 6px; min-width: 0; }
.nep-modLabel { font-size: 10.5px; font-weight: 700; letter-spacing: 0.2px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.nep-modSelect { min-height: 28px; max-width: 260px; font-size: 11.5px; }
.nep-modVersion { max-width: 190px; }
.nep-modActions { display: flex; align-items: center; gap: 5px; margin-left: auto; flex-wrap: wrap; }
.nep-modActions .ne-btn { white-space: nowrap; }
.nep-modEmpty { font-size: 11px; }
.nep-modMeta { display: flex; align-items: center; gap: 8px; min-width: 0; }
.nep-modState { display: inline-flex; align-items: center; gap: 5px; flex: none; font-size: 10.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.nep-modState[data-dirty="true"] { color: var(--dsw-alias-state-warn-primary); }
.nep-modDot { width: 6px; height: 6px; border-radius: 999px; background: var(--dsw-alias-state-idle-primary); }
.nep-modState[data-dirty="true"] .nep-modDot { background: var(--dsw-alias-state-warn-primary); }
.nep-modChip {
  display: inline-flex; align-items: center; gap: 4px; flex: none;
  padding: 1px 7px; border-radius: 999px; font-size: 9.5px; white-space: nowrap;
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 25%, transparent);
}
.nep-modSummary { flex: 1; min-width: 0; font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---- files + editor ---- */
.nep-main { flex: 1; min-height: 0; display: flex; }
.nep-files {
  width: 212px; flex: none; border-right: 1px solid var(--dsw-alias-border-l1);
  display: flex; flex-direction: column; min-height: 0;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 26%, transparent);
}
.nep-filesHead { display: flex; align-items: center; gap: 6px; padding: 9px 9px 7px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.nep-filesTitle { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--dsw-alias-label-secondary); letter-spacing: 0.2px; }
.nep-fileActions { margin-left: auto; display: flex; gap: 0; }
.nep-fileList { flex: 1; min-height: 0; padding: 6px 6px 10px; display: flex; flex-direction: column; gap: 1px; }
.nep-filesEmpty { font-size: 11px; padding: 8px; }
.nep-filesHint { margin: 0; padding: 7px 10px 8px; font-size: 10px; color: var(--dsw-alias-label-secondary); border-top: 1px solid var(--dsw-alias-border-l1); line-height: 1.5; }
/* Sandbox tree: indented rows (inline paddingLeft carries the depth). */
.nep-fileRow, .nep-treeRow {
  display: flex; align-items: center; gap: 5px; width: 100%; min-height: 25px;
  padding: 3px 7px 3px 4px; border: none; border-radius: 6px; background: transparent;
  color: var(--dsw-alias-label-secondary); font-size: 11.5px; text-align: left; cursor: pointer;
  overflow: hidden; transition: background 110ms ease, color 110ms ease;
}
.nep-fileRow:hover, .nep-treeRow:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); color: var(--dsw-alias-label-primary); }
.nep-fileRow[data-active="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 11%, transparent);
  color: var(--dsw-alias-brand-primary); font-weight: 600;
  box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary);
}
.nep-fileRow .ne-glyph, .nep-treeRow .ne-glyph { flex: none; opacity: 0.8; }
.nep-treeName { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nep-treeRow { color: var(--dsw-alias-label-primary); font-weight: 550; }
.nep-treeDir { cursor: default; gap: 2px; }
.nep-treeRow[data-selected="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent);
  color: var(--dsw-alias-brand-primary);
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
}
/* The twisty only expands/collapses; the folder label only selects. */
.nep-twistyBtn {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 16px; height: 18px; padding: 0; border: none; border-radius: 4px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  cursor: pointer; opacity: 0.75;
}
.nep-twistyBtn:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); opacity: 1; }
.nep-twistyEmpty { visibility: hidden; }
.nep-dirLabel {
  display: flex; align-items: center; gap: 5px; flex: 1; min-width: 0;
  padding: 2px 4px; border: none; border-radius: 5px; background: transparent;
  color: var(--dsw-alias-label-primary); font-size: 11.5px; font-weight: 550;
  text-align: left; cursor: pointer; overflow: hidden;
}
.nep-dirLabel:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.nep-dirLabel .ne-glyph { flex: none; opacity: 0.8; }

/* Inline create file/folder form above the tree. */
.nep-createBar {
  flex: none; display: flex; flex-direction: column; gap: 5px;
  padding: 8px 9px 7px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent);
}
.nep-createHead { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 650; color: var(--dsw-alias-brand-primary); }
.nep-createRow { display: flex; align-items: center; gap: 3px; }
.nep-createInput { flex: 1; min-width: 0; min-height: 26px; padding: 4px 7px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.nep-createRow .ne-iconBtn { width: 24px; height: 24px; flex: none; color: var(--dsw-alias-brand-primary); }
.nep-createHint { margin: 0; font-size: 9.5px; color: var(--dsw-alias-label-secondary); line-height: 1.4; }

.nep-editorPane {
  --nep-od-bg: #282c34;
  --nep-od-bg-deep: #21252b;
  --nep-od-border: #181a1f;
  --nep-od-fg: #abb2bf;
  --nep-od-muted: #7f848e;
  --nep-od-comment: #5c6370;
  --nep-od-gutter: #4b5263;
  --nep-od-purple: #c678dd;
  --nep-od-green: #98c379;
  --nep-od-orange: #d19a66;
  --nep-od-yellow: #e5c07b;
  --nep-od-blue: #61afef;
  --nep-od-red: #e06c75;
  --nep-od-cyan: #56b6c2;
  flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0;
}
.nep-editorHead {
  flex: none; display: flex; align-items: center; gap: 8px; min-height: 34px;
  padding: 5px 12px; border-bottom: 1px solid var(--nep-od-border);
  background: var(--nep-od-bg-deep); color: var(--nep-od-fg);
}
.nep-editorPath { font-size: 11.5px; color: var(--nep-od-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nep-themeBadge {
  flex: none; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
  padding: 1px 6px; border-radius: 999px;
  color: var(--nep-od-green); background: rgba(152, 195, 121, 0.12);
  border: 1px solid rgba(152, 195, 121, 0.28);
}
.nep-dirty {
  font-size: 10px; color: var(--nep-od-yellow); white-space: nowrap;
  padding: 1px 7px; border-radius: 999px;
  background: rgba(229, 192, 123, 0.12);
  border: 1px solid rgba(229, 192, 123, 0.28);
}
.nep-editorActions { margin-left: auto; display: flex; gap: 6px; }
.nep-editorHead .ne-btn {
  background: #3a3f4b; border-color: #3a3f4b; color: var(--nep-od-fg);
}
.nep-editorHead .ne-btn:hover { background: #444a57; border-color: #444a57; }
.nep-editorHead .ne-btn:disabled { opacity: 0.4; }

.nep-editor { flex: 1; min-height: 0; display: flex; background: var(--nep-od-bg); overflow: hidden; }
.nep-gutter {
  flex: none; width: 48px; padding: 12px 0; overflow: hidden;
  border-right: 1px solid var(--nep-od-border);
  background: var(--nep-od-bg-deep);
  font-size: 12px; line-height: 20px; color: var(--nep-od-gutter);
  text-align: right; user-select: none; font-variant-numeric: tabular-nums;
}
.nep-gutterLine { padding-right: 10px; }
.nep-codeWrap { flex: 1; min-width: 0; position: relative; overflow: hidden; }
/* The transparent textarea and the highlighted overlay MUST use identical font
   metrics, otherwise the caret drifts away from the rendered glyphs. */
.nep-overlay, .nep-textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12.5px; line-height: 20px; font-weight: 400; font-style: normal;
  letter-spacing: 0; word-spacing: 0; tab-size: 2; white-space: pre;
  font-variant-ligatures: none; font-kerning: none; text-rendering: geometricPrecision;
}
.nep-overlay {
  margin: 0; position: absolute; inset: 0; overflow: hidden;
  padding: 12px 16px;
  pointer-events: none; color: var(--nep-od-fg);
  -webkit-font-smoothing: antialiased;
}
.nep-codeLine { display: block; height: 20px; }
.nep-textarea {
  position: absolute; inset: 0; width: 100%; height: 100%;
  margin: 0; padding: 12px 16px; border: none; outline: none; resize: none;
  background: transparent; color: transparent; caret-color: #528bff;
  overflow: auto;
  -webkit-text-fill-color: transparent;
}
.nep-textarea::selection { background: #3e4451; color: var(--nep-od-fg); -webkit-text-fill-color: var(--nep-od-fg); }
.nep-tokKeyword { color: var(--nep-od-purple); font-weight: 600; }
.nep-tokString { color: var(--nep-od-green); }
.nep-tokComment { color: var(--nep-od-comment); font-style: italic; }
.nep-tokDecorator { color: var(--nep-od-yellow); }
.nep-tokNumber { color: var(--nep-od-orange); }
.nep-tokFn { color: var(--nep-od-blue); }
.nep-tokType { color: var(--nep-od-yellow); }

/* Inline "save named version" form inside the module bar. */
.nep-modForm {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 6px 12px 8px; border-top: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 4%, transparent);
}
.nep-modInput { flex: 1; min-width: 150px; max-width: 340px; min-height: 26px; padding: 4px 8px; font-size: 11.5px; }
.nep-modHint { font-size: 9.5px; white-space: nowrap; }

/* ---- request console ---- */
.nep-output {
  flex: none; height: 43%; min-height: 196px; max-height: 64%;
  display: flex; flex-direction: column; border-top: 1px solid var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 30%, var(--dsw-alias-bg-base));
  transition: height 140ms ease;
}
/* Collapsed run/output panel: keep the header only so the editor can grow. */
.nep-output[data-collapsed="true"] { height: auto; min-height: 0; max-height: none; flex: none; }
.nep-output[data-collapsed="true"] .nep-console,
.nep-output[data-collapsed="true"] .nep-runError { display: none; }
.nep-outputToggle { width: 24px; height: 24px; flex: none; margin-left: 2px; }
.nep-outputHead { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.nep-outputTitle { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; flex: none; letter-spacing: 0.2px; color: var(--dsw-alias-label-secondary); }
.nep-routeChips { display: flex; gap: 5px; overflow-x: auto; flex: 1; min-width: 0; padding-bottom: 1px; scrollbar-width: none; }
.nep-routeChips::-webkit-scrollbar { display: none; }
.nep-routeChip {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary); font-size: 10.5px; cursor: pointer; white-space: nowrap;
  transition: border-color 120ms ease, color 120ms ease;
}
.nep-routeChip:hover { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); color: var(--dsw-alias-brand-primary); }
.nep-outputActions { margin-left: auto; display: flex; gap: 5px; flex: none; }
.nep-method { font-size: 9.5px; font-weight: 750; letter-spacing: 0.3px; color: var(--dsw-alias-brand-primary); }
.nep-runError {
  flex: none; display: flex; align-items: center; gap: 10px; justify-content: space-between;
  margin: 7px 12px 0; padding: 7px 10px; border-radius: 8px; font-size: 11.5px;
  color: var(--dsw-alias-state-error-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 25%, transparent);
}
.nep-console { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 8px 12px 11px; gap: 8px; }
.nep-requestForm { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.nep-methodSelect { width: 90px; font-weight: 600; }
.nep-pathInput { flex: 1; min-width: 130px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; }
.nep-bodyInput { flex-basis: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; resize: vertical; }
.nep-logs {
  flex: none; max-height: 120px; overflow: auto; margin: 0;
  padding: 8px 10px; border-radius: 8px; font-size: 10.5px; line-height: 1.5;
  background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary); white-space: pre-wrap; word-break: break-word;
}
.nep-results { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 7px; }
.nep-resultsEmpty { padding: 12px 2px; font-size: 11.5px; }
.nep-result { flex: none; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; overflow: hidden; background: var(--dsw-alias-bg-base); }
.nep-resultHead { display: flex; align-items: center; gap: 8px; padding: 5px 10px; font-size: 11px; background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 70%, transparent); }
.nep-resultPath { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.nep-resultStatus { font-weight: 750; font-variant-numeric: tabular-nums; }
.nep-result[data-tone="success"] .nep-resultStatus { color: var(--dsw-alias-state-success-primary); }
.nep-result[data-tone="warn"] .nep-resultStatus { color: var(--dsw-alias-state-warn-primary); }
.nep-result[data-tone="error"] .nep-resultStatus { color: var(--dsw-alias-state-error-primary); }
.nep-resultTime { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.nep-resultBody { margin: 0; padding: 8px 10px; max-height: 190px; overflow: auto; font-size: 10.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.nep-resultError { margin: 0; padding: 8px 10px; font-size: 11px; color: var(--dsw-alias-state-error-primary); }

@media (max-width: 1120px) {
  .nep-left { width: 34%; max-width: 440px; }
  .nep-files { width: 186px; }
  .nep-toolbarActions .ne-btn span { display: none; }
  .nep-modSelect { max-width: 200px; }
}
@media (max-width: 980px) {
  .nep-split { flex-direction: column; }
  .nep-left { width: 100%; max-width: none; flex: 0 0 42%; min-height: 230px; height: auto; border-right: none; border-bottom: 1px solid var(--dsw-alias-border-l2); }
  .nep-right { flex: 1; }
  .nep-files { width: 172px; }
  .nep-output { height: 46%; max-height: 56%; }
  .nep-modRow { gap: 8px; }
  .nep-modField { flex: 1 1 100%; }
  .nep-modSelect { flex: 1; max-width: none; }
  .nep-modActions { margin-left: 0; }
  .nep-modMeta { flex-wrap: wrap; }
}
@media (max-width: 680px) {
  .nep-files { display: none; }
  .nep-toolbar { flex-wrap: wrap; }
  .nep-toolbarText { flex: 1 1 100%; }
  .nep-toolbarActions { width: 100%; margin-left: 0; justify-content: flex-start; }
  .nep-output { height: 52%; max-height: 62%; }
  .nep-gutter { width: 38px; }
  .nep-outputHead { flex-wrap: wrap; }
  .nep-outputActions { width: 100%; margin-left: 0; }
  .nep-modSummary { flex-basis: 100%; white-space: normal; }
}
`;
// #endregion
