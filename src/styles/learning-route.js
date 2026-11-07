// #region learning route styles
// Staged learning route: progress hero, track switcher, vertical stage
// timeline with checkable item cards, and stage checkpoints.

const NEST_CSS_LEARNING_ROUTE = `
.ner-view { flex: 1; min-height: 0; display: flex; background: var(--dsw-alias-bg-base); }
.ner-main { flex: 1; min-width: 0; padding: 0 30px 70px; }

/* ---- hero ---- */
.ner-head {
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px 24px;
  padding: 22px 0 16px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.ner-headText { flex: 1 1 420px; min-width: 0; max-width: 720px; }
.ner-headText .ne-sectionTitle { font-size: 20px; font-weight: 720; }
.ner-headText .ne-sectionIntro { margin-top: 7px; line-height: 1.65; }
.ner-progressBox {
  width: 316px; flex: none; padding: 13px 14px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background:
    linear-gradient(140deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent), transparent 60%),
    var(--dsw-alias-bg-layer-1);
  box-shadow: 0 3px 14px color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
}
.ner-progressRow { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); margin-bottom: 8px; }
.ner-progressValue { font-weight: 650; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }
.ner-bar { height: 6px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent); }
.ner-barBig { height: 8px; }
.ner-barFill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--dsw-alias-brand-primary), color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-state-success-primary))); transition: width 260ms ease; }
.ner-progressMeta { display: flex; gap: 6px; margin-top: 9px; flex-wrap: wrap; }

/* ---- track switcher ---- */
.ner-tracks {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin: 15px 0 6px; padding: 4px; border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 55%, transparent);
  border: 1px solid var(--dsw-alias-border-l1);
  width: fit-content; max-width: 100%;
}
.ner-trackLabel { font-size: 10.5px; color: var(--dsw-alias-label-secondary); padding: 0 5px 0 7px; font-weight: 600; }
.ner-track {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 5px 10px 5px 12px; border-radius: 7px; cursor: pointer; font-size: 11.5px;
  border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary);
  transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
}
.ner-trackName { white-space: nowrap; }
.ner-trackCount {
  min-width: 17px; height: 17px; padding: 0 4px; border-radius: 5px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 9.5px; font-weight: 750; font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
}
.ner-track[data-active="true"] .ner-trackCount {
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
}
.ner-track:hover { color: var(--dsw-alias-label-primary); background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.ner-track[data-active="true"] {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 32%, transparent);
  color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-bg-base) 75%, transparent);
  font-weight: 650; box-shadow: 0 1px 3px color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
}

/* ---- timeline ---- */
.ner-trackSummary {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap;
  margin: 12px 0 4px; padding: 12px 14px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: linear-gradient(120deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent), transparent 60%);
}
.ner-trackSummaryText { flex: 1 1 320px; min-width: 0; }
.ner-trackSummaryTitle { display: block; font-size: 12.5px; font-weight: 700; }
.ner-trackSummaryDesc { margin: 3px 0 0; font-size: 11.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.ner-trackSkipped {
  margin: 6px 0 0; display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; color: var(--dsw-alias-state-warn-primary);
  padding: 2px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 22%, transparent);
}
.ner-trackStats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: none; padding-top: 2px; }
.ner-timeline { display: flex; flex-direction: column; margin-top: 14px; }
.ner-stage { display: flex; gap: 14px; }
.ner-stageRail { width: 30px; flex: none; display: flex; flex-direction: column; align-items: center; }
.ner-stageIndex {
  width: 30px; height: 30px; border-radius: 50%; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11.5px; font-weight: 750; color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-base));
  border: 1.5px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 34%, transparent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, transparent);
}
.ner-stageLine { flex: 1; width: 2px; margin: 6px 0 2px; background: linear-gradient(180deg, var(--dsw-alias-border-l2), color-mix(in srgb, var(--dsw-alias-border-l1) 35%, transparent)); }
.ner-stageBody { flex: 1; min-width: 0; padding-bottom: 24px; }
.ner-stageHead { display: flex; align-items: flex-start; gap: 16px; margin: 3px 0 12px; }
.ner-stageTitleWrap { flex: 1; min-width: 0; }
.ner-stageTitleRow { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.ner-stageTitle { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.1px; }
.ner-stageGoal { margin: 4px 0 0; font-size: 12px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }
.ner-stageProgress { flex: none; width: 190px; display: flex; flex-direction: column; gap: 5px; align-items: flex-end; padding-top: 2px; }
.ner-stageCount { font-size: 10.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.ner-stageProgress .ner-bar { width: 100%; height: 5px; }
.ner-stageProgress .ne-linkBtn { font-size: 10.5px; }

/* ---- item cards ---- */
.ner-items { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 342px), 1fr)); gap: 10px; }
.ner-item {
  position: relative; display: flex; flex-direction: column; gap: 8px;
  padding: 13px 14px; border-radius: 11px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  transition: border-color 130ms ease, box-shadow 130ms ease, opacity 130ms ease;
}
.ner-item:hover { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, var(--dsw-alias-border-l1)); box-shadow: 0 3px 12px color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.ner-item[data-done="true"] { opacity: 0.82; border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 28%, var(--dsw-alias-border-l1)); }
.ner-item[data-done="true"] .ner-itemTitle { color: var(--dsw-alias-label-secondary); }
.ner-itemHead { display: flex; align-items: flex-start; gap: 10px; }
.ner-check {
  flex: none; width: 20px; height: 20px; margin-top: 1px; border-radius: 6px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-bg-base);
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.ner-check:hover { border-color: var(--dsw-alias-state-success-primary); transform: scale(1.05); }
.ner-check[aria-pressed="true"] { border-color: var(--dsw-alias-state-success-primary); background: var(--dsw-alias-state-success-primary); }
.ner-itemTitleWrap { flex: 1; min-width: 0; }
.ner-itemTitle { margin: 0; font-size: 12.5px; font-weight: 650; }
.ner-itemGoal { margin: 3px 0 0; font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.55; }
.ner-itemMeta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
.ner-level {
  font-size: 9.5px; font-weight: 750; padding: 1px 5px; border-radius: 5px;
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.ner-points { list-style: none; margin: 0; padding: 0 0 0 2px; display: flex; flex-direction: column; gap: 4px; }
.ner-points li { position: relative; padding-left: 13px; font-size: 11.5px; line-height: 1.58; color: var(--dsw-alias-label-secondary); }
.ner-points li::before { content: ''; position: absolute; left: 2px; top: 7px; width: 4px; height: 4px; border-radius: 50%; background: var(--dsw-alias-brand-primary); opacity: 0.55; }
.ner-facts { display: flex; flex-direction: column; gap: 5px; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.ner-fact { margin: 0; display: flex; gap: 8px; font-size: 11px; line-height: 1.55; }
.ner-factLabel { flex: none; width: 54px; font-weight: 650; color: var(--dsw-alias-brand-primary); }
.ner-factText { color: var(--dsw-alias-label-secondary); }
.ner-itemFoot { display: flex; flex-direction: column; gap: 8px; margin-top: auto; padding-top: 2px; }
.ner-itemFoot .ne-pillRow { gap: 4px; }
.ner-itemActions { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }

/* ---- checkpoints ---- */
.ner-checkpoints {
  margin-top: 14px; padding: 16px 18px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-state-success-primary) 5%, transparent), transparent 55%),
    color-mix(in srgb, var(--dsw-alias-bg-layer-1) 55%, transparent);
}
.ner-checkpointsTitle { display: flex; align-items: center; gap: 7px; margin: 0 0 11px; font-size: 13px; font-weight: 700; }
.ner-checkpointsTitle .ne-glyph { color: var(--dsw-alias-state-success-primary); }
.ner-checkpointGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap: 10px; }
.ner-checkpoint {
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 11px; border-radius: 9px;
  background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1);
}
.ner-checkpointIndex {
  flex: none; width: 21px; height: 21px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 750; color: var(--dsw-alias-state-success-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent);
}
.ner-checkpoint strong { font-size: 12px; }
.ner-checkpoint p { margin: 2px 0 0; font-size: 11px; line-height: 1.55; color: var(--dsw-alias-label-secondary); }

@media (max-width: 1080px) {
  .ner-head { flex-direction: column; gap: 14px; }
  .ner-progressBox { width: 100%; max-width: 420px; }
  .ner-stageProgress { width: 150px; }
}
@media (max-width: 860px) {
  .ner-main { padding: 0 18px 50px; }
  .ner-stageHead { flex-direction: column; gap: 10px; }
  .ner-stageProgress { width: 100%; align-items: flex-start; }
  .ner-items { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .ner-main { padding: 0 12px 40px; }
  .ner-stage { gap: 10px; }
  .ner-stageRail { width: 24px; }
  .ner-stageIndex { width: 24px; height: 24px; font-size: 10px; }
  .ner-itemActions .ne-btn span { display: none; }
}
`;
// #endregion
