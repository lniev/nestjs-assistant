// #region knowledge styles
// Knowledge overview: TOC sidebar + reading column. Uses host theme tokens only.

const NEST_CSS_KNOWLEDGE = `
.nek-view { flex: 1; min-height: 0; display: flex; background: var(--dsw-alias-bg-base); }

/* ---- table of contents ---- */
.nek-toc {
  width: 284px; flex: none; display: flex; flex-direction: column; min-height: 0;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-layer-1) 66%, transparent), color-mix(in srgb, var(--dsw-alias-bg-layer-1) 30%, transparent));
}
.nek-search {
  flex: none; display: flex; align-items: center; gap: 7px; padding: 12px 12px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.nek-search:focus-within .nek-searchBox { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 52%, var(--dsw-alias-border-l1)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent); }
.nek-searchIcon { color: var(--dsw-alias-label-secondary); display: inline-flex; }
.nek-searchInput {
  flex: 1; min-width: 0; padding: 6px 2px; border: none; background: transparent; outline: none;
  font-size: 12px;
}
.nek-searchInput::placeholder { color: color-mix(in srgb, var(--dsw-alias-label-secondary) 78%, transparent); }
.nek-searchBox {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px;
  padding: 0 9px; min-height: 32px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.nek-searchClear { transform: rotate(45deg); }
.nek-tocList { flex: 1; min-height: 0; padding: 9px 8px 18px; }
.nek-chapter { margin-bottom: 3px; }
.nek-chapterHead {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 7px 8px; border: none; border-radius: 8px; background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-primary); text-align: left; font-size: 12px;
  transition: background 120ms ease;
}
.nek-chapterHead:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.nek-chevron { display: inline-flex; color: var(--dsw-alias-label-secondary); transition: transform 140ms ease; }
.nek-chevron[data-open="true"] { transform: rotate(90deg); }
.nek-chapterTitle { font-weight: 650; white-space: nowrap; }
.nek-chapterEn { font-size: 10.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nek-chapterCount {
  margin-left: auto; font-size: 9.5px; color: var(--dsw-alias-label-secondary);
  flex: none; font-variant-numeric: tabular-nums; min-width: 18px; height: 17px;
  padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
}
.nek-chapterBody { margin: 1px 0 5px 15px; padding-left: 10px; border-left: 1px solid var(--dsw-alias-border-l1); }
.nek-chapterIntro { margin: 1px 6px 7px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); line-height: 1.55; }
.nek-pageRow {
  display: flex; align-items: center; gap: 6px; width: 100%;
  min-height: 27px; padding: 3px 8px; border: none; border-radius: 7px; background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-secondary); text-align: left; font-size: 11.5px;
  transition: background 110ms ease, color 110ms ease;
}
.nek-pageRow:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); color: var(--dsw-alias-label-primary); }
.nek-pageRow[data-active="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 11%, transparent);
  color: var(--dsw-alias-brand-primary); font-weight: 600;
  box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary);
}
.nek-pageDot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: 0.4; flex: none; }
.nek-pageRow[data-active="true"] .nek-pageDot { opacity: 1; }
.nek-pageLabel { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nek-pageEn { display: none; }
.nek-tocFoot {
  flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 9px 12px; border-top: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 40%, transparent);
}
.nek-source { font-size: 10px; color: var(--dsw-alias-label-secondary); }
.nek-results { padding: 2px; }
.nek-resultCount { margin: 3px 7px 7px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.nek-emptyLine { font-size: 11.5px; padding: 10px; }
.nek-resultRow {
  display: flex; flex-direction: column; gap: 2px; width: 100%;
  padding: 8px 9px; border: 1px solid transparent; border-radius: 8px; background: transparent;
  cursor: pointer; text-align: left; color: var(--dsw-alias-label-primary); margin-bottom: 2px;
  transition: background 110ms ease, border-color 110ms ease;
}
.nek-resultRow:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent); }
.nek-resultRow[data-active="true"] { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }
.nek-resultTitle { font-size: 12px; font-weight: 600; }
.nek-resultMeta { font-size: 10px; color: var(--dsw-alias-label-secondary); }
.nek-resultSummary { font-size: 10.5px; color: var(--dsw-alias-label-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* ---- reading column ---- */
.nek-content { flex: 1; min-width: 0; padding: 0 0 64px; }
.nek-contentHead {
  display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px 20px;
  padding: 20px 30px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent), transparent 55%),
    color-mix(in srgb, var(--dsw-alias-bg-layer-1) 24%, transparent);
}
.nek-contentHeading { flex: 1 1 420px; min-width: 0; max-width: 720px; }
.ne-sectionTitle { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.1px; }
.ne-sectionIntro { margin: 6px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.6; max-width: 720px; }
.nek-contentHeadMeta { flex: 0 1 auto; display: flex; align-items: center; gap: 14px; padding-top: 4px; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; }
.nek-headStat { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; min-width: 46px; }
.nek-headStat strong { font-size: 17px; font-weight: 700; line-height: 1.15; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }
.nek-headStat span { font-size: 10px; color: var(--dsw-alias-label-secondary); }
.nek-headSource { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); padding-left: 14px; border-left: 1px solid var(--dsw-alias-border-l1); align-self: stretch; }
.nek-sourceDot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); }

.nek-pageContent { box-sizing: border-box; width: 100%; padding: 22px 30px 0; max-width: 980px; margin: 0 auto; }
.nek-pageHead { display: flex; flex-direction: column; gap: 8px; padding: 2px 0 16px; }
.nek-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.nek-breadcrumbChapter { color: var(--dsw-alias-brand-primary); font-weight: 500; }
.nek-breadcrumbSep { opacity: 0.45; }
.nek-titleRow { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.nek-pageTitle { margin: 0; font-size: 26px; line-height: 1.25; font-weight: 720; letter-spacing: -0.2px; }
.nek-pageEnTitle { font-size: 12px; color: var(--dsw-alias-label-secondary); font-weight: 400; }
.nek-pageActions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 4px; }
.nek-metaRow { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }

.nek-block { margin-bottom: 22px; }
.nek-blockTitle { display: flex; align-items: center; gap: 7px; margin: 0 0 10px; font-size: 13px; font-weight: 700; letter-spacing: 0.1px; }
.nek-blockTitle .ne-glyph { color: var(--dsw-alias-brand-primary); }
.nek-summaryCard {
  position: relative; margin-bottom: 22px; padding: 15px 17px 15px 19px; border-radius: 12px;
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent), transparent 60%),
    var(--dsw-alias-bg-layer-1);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
  overflow: hidden;
}
.nek-summaryCard::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(180deg, var(--dsw-alias-brand-primary), color-mix(in srgb, var(--dsw-alias-brand-primary) 25%, transparent));
}
.nek-summaryText { margin: 0; font-size: 13px; line-height: 1.8; }
.nek-sectionGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 10px; }
.nek-section {
  padding: 12px 13px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  transition: border-color 120ms ease;
}
.nek-section:hover { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, var(--dsw-alias-border-l1)); }
.nek-sectionHeading { margin: 0 0 5px; font-size: 12.5px; font-weight: 650; color: var(--dsw-alias-brand-primary); }
.nek-sectionText { margin: 0; font-size: 12px; line-height: 1.68; color: var(--dsw-alias-label-primary); }
.nek-points {
  list-style: none; margin: 0; padding: 4px 14px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
}
.nek-point { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; line-height: 1.62; padding: 8px 0; }
.nek-point + .nek-point { border-top: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 60%, transparent); }
.nek-pointIndex {
  flex: none; width: 19px; height: 19px; margin-top: 1px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.nek-snippets { display: flex; flex-direction: column; gap: 12px; }
.nek-snippet { border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-base); }
.nek-snippetHead {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 7px 11px; background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 80%, transparent);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.nek-snippetTitle { font-size: 11.5px; font-weight: 600; }
.nek-snippetTools { display: flex; align-items: center; gap: 6px; }
.nek-code {
  margin: 0; padding: 13px 15px; overflow-x: auto; background: var(--dsw-alias-bg-base);
  font-size: 11.5px; line-height: 1.65; color: var(--dsw-alias-label-primary); tab-size: 2;
}
.nek-apiChip {
  padding: 3px 8px; border-radius: 6px; font-size: 11px;
  color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 20%, transparent);
}
.nek-pitfalls {
  list-style: none; margin: 0; padding: 11px 14px; border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 4%, var(--dsw-alias-bg-layer-1));
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent);
}
.nek-pitfalls li { display: flex; gap: 9px; align-items: flex-start; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-primary); }
.nek-pitfalls li + li { margin-top: 7px; }
.nek-pitfallMark {
  flex: none; width: 17px; height: 17px; margin-top: 1px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
  color: var(--dsw-alias-state-warn-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 15%, transparent);
}
.nek-enterpriseCard {
  margin-bottom: 22px; padding: 14px 16px; border-radius: 11px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 22%, transparent);
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--dsw-alias-state-success-primary) 7%, transparent), transparent 65%),
    var(--dsw-alias-bg-layer-1);
}
.nek-enterpriseCard p { margin: 0; font-size: 12.5px; line-height: 1.72; }
.nek-authorNote { margin: 20px 0 0; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.nek-pager {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%; max-width: 980px; margin: 26px auto 0; padding: 16px 30px 0; border-top: 1px solid var(--dsw-alias-border-l1);
}
.nek-pager .ne-btn { max-width: 46%; }
.nek-pagerPage { color: var(--dsw-alias-label-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 1080px) {
  .nek-toc { width: 250px; }
  .nek-contentHead { padding: 16px 20px 14px; }
  .nek-pageContent { padding: 18px 20px 0; }
  .nek-contentHeadMeta { gap: 12px; }
  .nek-headSource { display: none; }
  .nek-pageEn { display: none; }
}
@media (max-width: 840px) {
  .nek-contentHead { flex-direction: column; gap: 12px; }
  .nek-contentHeadMeta { justify-content: flex-start; }
  .nek-pageTitle { font-size: 22px; }
  .nek-pageContent { padding: 16px 16px 0; }
  .nek-pager { padding: 14px 16px 0; }
}
@media (max-width: 760px) {
  .nek-view { flex-direction: column; }
  .nek-toc { width: 100%; max-height: 236px; border-right: none; border-bottom: 1px solid var(--dsw-alias-border-l2); }
  .nek-pageActions .ne-btn span { display: none; }
  .nek-pager .nek-pagerPage { display: none; }
}
`;
// #endregion
