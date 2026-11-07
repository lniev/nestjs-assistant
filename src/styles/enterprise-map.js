// #region enterprise map styles
// Enterprise map: layers -> capability domains -> a detail column with
// practices, checks, anti-patterns and Nest APIs. Theme tokens only.

const NEST_CSS_ENTERPRISE_MAP = `
.nem-view { flex: 1; min-height: 0; display: flex; position: relative; background: var(--dsw-alias-bg-base); }
.nem-main { flex: 1; min-width: 0; padding: 0 30px 68px; }

/* ---- hero header ---- */
.nem-head {
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 14px 22px;
  padding: 22px 0 16px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  background:
    radial-gradient(ellipse at 90% 0%, color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, transparent), transparent 50%);
}
.nem-headText { min-width: 0; flex: 1 1 420px; max-width: 760px; }
.nem-headText .ne-sectionTitle { font-size: 20px; font-weight: 720; }
.nem-headText .ne-sectionIntro { margin-top: 7px; line-height: 1.65; }
.nem-stats { display: flex; gap: 8px; flex: none; padding-top: 3px; flex-wrap: wrap; justify-content: flex-end; }
.nem-sectionLabel { margin: 0 0 10px; font-size: 12px; font-weight: 700; color: var(--dsw-alias-label-secondary); letter-spacing: 0.4px; }

/* ---- maturity ladder ---- */
.nem-maturity { margin: 18px 0 16px; }
.nem-maturityRow { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; }
.nem-maturityStep {
  flex: 1; min-width: 174px; display: flex; align-items: flex-start; gap: 10px; position: relative;
  padding: 11px 12px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  transition: border-color 120ms ease, transform 120ms ease;
}
.nem-maturityStep:hover { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 32%, var(--dsw-alias-border-l1)); transform: translateY(-1px); }
.nem-maturityBadge {
  flex: none; width: 28px; height: 28px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 750; color: var(--dsw-alias-brand-primary);
  background: linear-gradient(145deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent), color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent));
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
}
.nem-maturityText { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nem-maturityText strong { font-size: 12px; font-weight: 650; }
.nem-maturityText span { font-size: 10.5px; color: var(--dsw-alias-label-secondary); line-height: 1.5; }
.nem-maturityArrow { margin-left: auto; align-self: center; color: var(--dsw-alias-label-secondary); font-size: 15px; opacity: 0.5; }
.nem-selectHint { margin: 0 0 16px; font-size: 11px; color: var(--dsw-alias-label-secondary); }

/* ---- layer sections ---- */
.nem-layer { margin-bottom: 24px; }
.nem-layerHead { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 11px; }
.nem-layerBar {
  flex: none; width: 4px; height: 32px; margin-top: 1px; border-radius: 4px;
  background: linear-gradient(180deg, var(--dsw-alias-brand-primary), color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent));
}
.nem-layerTitle { margin: 0; font-size: 14px; font-weight: 680; letter-spacing: 0.1px; }
.nem-layerDesc { margin: 2px 0 0; font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.55; }

/* ---- domain cards ---- */
.nem-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 264px), 1fr)); gap: 10px; counter-reset: nestDomain; }
.nem-card {
  position: relative; display: flex; flex-direction: column; gap: 8px; text-align: left;
  padding: 13px 14px 11px; border-radius: 11px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  transition: border-color 130ms ease, transform 130ms ease, background 130ms ease, box-shadow 130ms ease;
  overflow: hidden;
}
.nem-card::before {
  counter-increment: nestDomain;
  content: counter(nestDomain, decimal-leading-zero);
  position: absolute; right: 12px; top: 10px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.5px; font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary); opacity: 0.4;
}
.nem-card::after {
  content: ''; position: absolute; left: 0; right: 0; top: 0; height: 2px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent), transparent 70%);
  opacity: 0; transition: opacity 130ms ease;
}
.nem-card:hover {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 38%, var(--dsw-alias-border-l1));
  transform: translateY(-2px);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
}
.nem-card:hover::after { opacity: 1; }
.nem-card[data-selected="true"] {
  border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, var(--dsw-alias-bg-layer-1));
}
.nem-card[data-selected="true"]::after { opacity: 1; }
.nem-cardTop { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; padding-right: 22px; }
.nem-cardTitle { margin: 0; font-size: 13.5px; font-weight: 680; }
.nem-cardEn { font-size: 10px; color: var(--dsw-alias-label-secondary); }
.nem-cardEssential { margin: 0; font-size: 11.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.nem-cardFooter { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: auto; padding-top: 3px; }
.nem-cardApi { font-size: 9.5px; color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; opacity: 0.7; }

/* ---- detail column ---- */
.nem-detail {
  width: 408px; flex: none; display: flex; flex-direction: column; min-height: 0;
  border-left: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  box-shadow: -10px 0 32px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
  animation: nemSlideIn 160ms ease;
}
@keyframes nemSlideIn { from { transform: translateX(14px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.nem-detailHead {
  flex: none; display: flex; align-items: flex-start; gap: 10px; padding: 16px 16px 13px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent), transparent);
}
.nem-detailTitleWrap { min-width: 0; flex: 1; }
.nem-detailTitle { margin: 0; font-size: 17px; font-weight: 700; }
.nem-detailEn { margin: 2px 0 0; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.nem-detailBody { flex: 1; min-height: 0; padding: 6px 16px 24px; }
.nem-detailBlock { margin: 15px 0; }
.nem-detailLabel { margin: 0 0 7px; font-size: 10px; font-weight: 750; letter-spacing: 0.8px; color: var(--dsw-alias-brand-primary); text-transform: uppercase; }
.nem-detailText { margin: 0; font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-primary); }
.nem-practiceList { display: flex; flex-direction: column; gap: 10px; }
.nem-practice {
  padding: 10px 11px; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  border-left: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
}
.nem-practiceHead { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.nem-practiceTitle { margin: 0; font-size: 12px; font-weight: 650; }
.nem-practiceText { margin: 0; font-size: 11.5px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.nem-refRow { margin-top: 8px; }
.nem-level {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  min-width: 25px; height: 17px; padding: 0 5px; border-radius: 5px;
  font-size: 9.5px; font-weight: 750; letter-spacing: 0.2px;
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.nem-level[data-level="L1"] { color: var(--dsw-alias-state-idle-primary); background: color-mix(in srgb, var(--dsw-alias-state-idle-primary) 16%, transparent); }
.nem-level[data-level="L2"] { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 11%, transparent); }
.nem-level[data-level="L3"] { color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); }
.nem-level[data-level="L4"] { color: var(--dsw-alias-state-warn-primary); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent); }
.nem-checks, .nem-antis { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.nem-checks li, .nem-antis li { display: flex; gap: 8px; align-items: flex-start; font-size: 11.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.nem-checks li .ne-glyph { color: var(--dsw-alias-state-success-primary); margin-top: 2px; }
.nem-antis li .ne-glyph { color: var(--dsw-alias-state-warn-primary); margin-top: 2px; }
.nem-apiChip {
  padding: 3px 7px; border-radius: 5px; font-size: 10.5px;
  color: var(--dsw-alias-label-primary);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
  border: 1px solid var(--dsw-alias-border-l1);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.nem-detailFoot { flex: none; padding: 11px 16px; border-top: 1px solid var(--dsw-alias-border-l1); background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 40%, transparent); }
.nem-detailFoot .ne-btn { width: 100%; }

/* ---- project template ---- */
.nem-template {
  margin-top: 26px; padding: 16px 18px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 55%, transparent);
}
.nem-templateSummary { margin: 0 0 10px; font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.nem-tree {
  margin: 0; padding: 14px 16px; border-radius: 9px; overflow-x: auto;
  font-size: 11px; line-height: 1.7;
  background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1);
}

@media (max-width: 1180px) {
  .nem-detail { position: absolute; right: 0; top: 0; bottom: 0; width: min(430px, 94%); z-index: 5; }
}
@media (max-width: 900px) {
  .nem-main { padding: 0 18px 48px; }
  .nem-head { flex-direction: column; gap: 10px; padding-top: 16px; }
  .nem-stats { justify-content: flex-start; }
  .nem-maturityStep { min-width: 100%; }
  .nem-maturityArrow { display: none; }
  .nem-grid { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
}
@media (max-width: 640px) {
  .nem-main { padding: 0 12px 40px; }
  .nem-grid { grid-template-columns: 1fr; }
}
`;
// #endregion
