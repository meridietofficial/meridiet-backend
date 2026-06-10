import fs from 'fs';
import path from 'path';
import type { DietPlan, WeekPlan, FeaturedRecipe } from '../models/DietPlan';
import { BRAND } from '../config/brand';

// ── Same palette as the frontend DietPlanDocument component ──────────────
const C = {
  brand:  '#1E8E3E',
  dark:   '#14532d',
  banner: '#15532a',
  gold:   '#C7A14A',
  ink:    '#1f2937',
  sub:    '#6b7280',
  faint:  '#9ca3af',
  line:   '#e6efe3',
  card:   '#f4f8f0',
  soft:   '#eef5ea',
  white:  '#ffffff',
  red:    '#dc2626',
};

// ── Images (base64 from backend's own public/images) ─────────────────────
const IMAGES_DIR =
  process.env.DIET_PLAN_IMAGES_DIR ??
  path.join(process.cwd(), 'public', 'images');

const imgCache: Record<string, string> = {};

const img = (filename: string): string => {
  if (imgCache[filename]) return imgCache[filename];
  const ext = path.extname(filename).slice(1).toLowerCase();
  const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';
  try {
    const data = fs.readFileSync(path.join(IMAGES_DIR, filename));
    imgCache[filename] = `data:${mime};base64,${data.toString('base64')}`;
    return imgCache[filename];
  } catch { return ''; }
};

// ── Inline SVG icons ──────────────────────────────────────────────────────
const SVG = {
  leaf:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  flame:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.187 2.003a.75.75 0 00-.75.75c0 2.044-.995 3.32-2.018 4.266-.69.636-1.44 1.14-2.008 1.585-.567.444-1.011.867-1.18 1.396A4.25 4.25 0 006 11c0 3.314 2.686 6 6 6s6-2.686 6-6c0-2.38-.927-4.485-2.35-5.997-.985-1.048-2.02-1.913-2.52-2.652a.75.75 0 00-.943-.348z"/></svg>`,
  heart:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  calendar:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  user:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  utensils:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
  droplets:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c0 0-6 7.5-6 12a6 6 0 0 0 12 0c0-4.5-6-12-6-12z"/></svg>`,
  dumbbell:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5h11"/><path d="M6.5 17.5h11"/><path d="M3 9.5h18v5H3z"/></svg>`,
  check:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  arrowR:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  star:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  clock:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  apple:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 1 5 5c0 3-2 5-5 5S7 10 7 7a5 5 0 0 1 5-5zm0 11c3.87 0 7 3.13 7 7H5c0-3.87 3.13-7 7-7z"/></svg>`,
  swap:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  target:    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  chart:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  phone:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.18h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.71 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.96 5.96l.79-.79a2 2 0 0 1 2.11-.45c.91.35 1.85.58 2.81.71A2 2 0 0 1 22 16.92z"/></svg>`,
  globe:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  mail:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
};

const icon = (name: keyof typeof SVG, size = 14, color = C.brand) =>
  `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;color:${color};flex-shrink:0;">${SVG[name]}</span>`;

// ── Helpers ───────────────────────────────────────────────────────────────
const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cap       = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const humanize  = (v: unknown): string => { if (v === null || v === undefined || v === '') return ''; return cap(String(v)); };
const toList    = (v: unknown): string[] => { if (Array.isArray(v)) return (v as unknown[]).filter(Boolean).map(String); if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean); return []; };
const none      = (v: unknown): string => { const l = toList(v).filter((x) => x.toLowerCase() !== 'none'); return l.length ? l.map(humanize).join(', ') : 'None'; };
const fmtDate   = (iso: string | null | undefined): string => { if (!iso) return '—'; const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso; return `${String(d.getDate()).padStart(2,'0')} / ${String(d.getMonth()+1).padStart(2,'0')} / ${d.getFullYear()}`; };
const todayFmt  = (): string => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')} / ${String(d.getMonth()+1).padStart(2,'0')} / ${d.getFullYear()}`; };

// ── Global CSS ────────────────────────────────────────────────────────────
const FONT = "'Segoe UI','Helvetica Neue',Arial,sans-serif";
const PAGE_W = 794;
const PAGE_H = 1123;

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${FONT}; background: #f0f0f0; }
svg { display: block; }
a { color: inherit; }

/* Each physical page */
.dp-page {
  width: ${PAGE_W}px;
  height: ${PAGE_H}px;
  overflow: hidden;
  position: relative;
  background: ${C.white};
  page-break-after: always;
  font-family: ${FONT};
  color: ${C.ink};
  box-sizing: border-box;
}
@media print { .dp-page { page-break-after: always; } }

/* ── Page header shared ── */
.pg-header {
  background: linear-gradient(135deg, ${C.dark} 0%, ${C.brand} 100%);
  padding: 18px 32px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.pg-header-logo { height: 32px; }
.pg-header-title {
  color: ${C.white};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  opacity: 0.85;
}
.pg-header-name {
  color: ${C.white};
  font-size: 15px;
  font-weight: 700;
  margin-left: auto;
}

/* ── Section card ── */
.sc {
  background: ${C.card};
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
}
.sc-head {
  background: linear-gradient(90deg, ${C.dark}, ${C.brand});
  color: ${C.white};
  padding: 8px 14px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sc-body { padding: 10px 14px; }

/* ── Icon row ── */
.icon-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid ${C.line};
}
.icon-row:last-child { border-bottom: none; }
.icon-row-label { font-size: 9px; font-weight: 600; color: ${C.sub}; text-transform: uppercase; letter-spacing: 0.5px; }
.icon-row-value { font-size: 11.5px; font-weight: 600; color: ${C.ink}; }
.icon-row-value.green { color: ${C.brand}; }
.icon-row-value.gold  { color: ${C.gold}; }

/* ── Week page ── */
.week-banner {
  background: linear-gradient(135deg, ${C.banner} 0%, ${C.brand} 100%);
  padding: 14px 24px;
  color: ${C.white};
}
.week-banner-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.7; }
.week-banner-title { font-size: 20px; font-weight: 800; margin-top: 2px; }
.week-banner-desc  { font-size: 11px; opacity: 0.8; margin-top: 3px; }
.week-focus-chips  { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.focus-chip {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: ${C.white};
}

/* ── Day card ── */
.days-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  padding: 8px 12px;
}
.day-card {
  background: ${C.white};
  border: 1px solid ${C.line};
  border-radius: 8px;
  overflow: hidden;
  font-size: 9px;
}
.day-head {
  background: linear-gradient(90deg, ${C.dark}, ${C.brand});
  color: ${C.white};
  padding: 5px 8px;
  font-weight: 700;
  font-size: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.day-head-num { font-size: 14px; font-weight: 800; }
.day-head-right { text-align: right; font-size: 8px; opacity: 0.85; line-height: 1.4; }
.day-timing { font-size: 8px; color: ${C.sub}; padding: 4px 8px; background: ${C.soft}; line-height: 1.6; border-bottom: 1px solid ${C.line}; }
.meal-section { padding: 4px 8px; border-bottom: 1px solid ${C.line}; }
.meal-section:last-child { border-bottom: none; }
.meal-tag {
  font-size: 7.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${C.brand};
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.meal-item { font-size: 8.5px; color: ${C.ink}; line-height: 1.4; }
.meal-qty  { color: ${C.sub}; font-size: 8px; }
.day-stats-row {
  background: ${C.soft};
  display: flex;
  justify-content: space-around;
  padding: 4px 4px;
  border-top: 1px solid ${C.line};
}
.ds { text-align: center; }
.ds-val { font-size: 9px; font-weight: 700; color: ${C.brand}; }
.ds-lbl { font-size: 7px; color: ${C.sub}; }

/* ── Weekly notes + swaps ── */
.notes-swaps {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 12px 8px;
}
.ns-box { background: ${C.card}; border-radius: 10px; padding: 10px 12px; }
.ns-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: ${C.dark};
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.ns-note { font-size: 9px; color: ${C.sub}; padding: 2px 0 2px 10px; position: relative; line-height: 1.4; }
.ns-note::before { content: '•'; position: absolute; left: 0; color: ${C.brand}; }
.swap-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; border-bottom: 1px solid ${C.line}; font-size: 9px; }
.swap-row:last-child { border-bottom: none; }
.swap-x { color: ${C.red}; text-decoration: line-through; flex: 1; }
.swap-ok { color: ${C.brand}; font-weight: 600; flex: 1; }

/* ── Recipe card ── */
.recipe-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px 20px; }
.recipe-card { background: ${C.card}; border-radius: 12px; overflow: hidden; }
.recipe-head { background: linear-gradient(90deg, ${C.dark}, ${C.brand}); color: ${C.white}; padding: 10px 14px; }
.recipe-name { font-size: 13px; font-weight: 700; }
.recipe-meta { font-size: 9px; opacity: 0.85; margin-top: 3px; display: flex; gap: 10px; }
.recipe-body { display: grid; grid-template-columns: 1fr 1fr; }
.recipe-col { padding: 8px 12px; border-right: 1px solid ${C.line}; }
.recipe-col:last-child { border-right: none; }
.recipe-col-title { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${C.brand}; margin-bottom: 5px; }
.recipe-item { font-size: 9px; color: ${C.sub}; padding: 1.5px 0 1.5px 10px; position: relative; line-height: 1.4; }
.recipe-item::before { content: '›'; position: absolute; left: 0; color: ${C.brand}; font-weight: 700; }
.macros-strip { display: flex; gap: 6px; padding: 7px 12px; background: ${C.soft}; }
.macro-pill { background: ${C.brand}; color: ${C.white}; border-radius: 20px; padding: 2px 8px; font-size: 8.5px; font-weight: 600; }

/* ── Hydration / swaps page ── */
.swaps-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
.swaps-table th { background: linear-gradient(90deg, ${C.dark}, ${C.brand}); color: ${C.white}; padding: 8px 12px; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
.swaps-table td { padding: 6px 12px; border-bottom: 1px solid ${C.line}; color: ${C.ink}; }
.swaps-table tr:nth-child(even) td { background: ${C.soft}; }
.swaps-table .td-x { color: ${C.red}; text-decoration: line-through; }
.swaps-table .td-ok { color: ${C.brand}; font-weight: 600; }

/* ── Progress page ── */
.prog-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
.prog-table th { background: ${C.dark}; color: ${C.white}; padding: 7px 10px; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 0.8px; }
.prog-table td { padding: 7px 10px; border-bottom: 1px solid ${C.line}; color: ${C.ink}; }
.prog-table tr:nth-child(even) td { background: ${C.soft}; }
.prog-table .cell-center { text-align: center; color: ${C.sub}; }

/* ── Dietitians page ── */
.dt-card { background: ${C.card}; border-radius: 12px; overflow: hidden; text-align: center; padding: 16px 12px; }
.dt-photo { width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 3px solid ${C.brand}; margin: 0 auto 8px; display: block; }
.dt-name { font-size: 12px; font-weight: 700; color: ${C.dark}; }
.dt-spec { font-size: 9.5px; color: ${C.brand}; font-weight: 600; margin-top: 1px; }
.dt-exp  { font-size: 9px; color: ${C.sub}; margin-top: 2px; }

/* ── Cover page ── */
.cover-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.cover-overlay { position: absolute; inset: 0; background: rgba(20,83,45,0.78); }
.cover-content { position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%; padding: 36px 48px; }
.cover-top { display: flex; align-items: center; gap: 14px; }
.cover-logo-img { height: 48px; }
.cover-logo-text { color: ${C.white}; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
.cover-tagline-text { color: rgba(255,255,255,0.75); font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
.cover-mid { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 32px 0; }
.cover-eyebrow { color: ${C.gold}; font-size: 10px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
.cover-h1 { color: ${C.white}; font-size: 38px; font-weight: 900; line-height: 1.1; letter-spacing: 0.05em; text-transform: uppercase; }
.cover-h2 { color: ${C.gold}; font-size: 38px; font-weight: 900; line-height: 1.1; letter-spacing: 0.05em; text-transform: uppercase; }
.cover-features { display: flex; gap: 24px; margin-top: 28px; flex-wrap: wrap; }
.cover-feature { display: flex; align-items: center; gap: 8px; color: ${C.white}; font-size: 10.5px; font-weight: 500; }
.cover-feature-icon { background: rgba(255,255,255,0.15); border-radius: 8px; padding: 6px; color: ${C.gold}; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; }
.cover-bottom-bar { background: linear-gradient(90deg, rgba(199,161,74,0.95), rgba(199,161,74,0.75)); border-radius: 12px; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
.cover-for-label { color: rgba(20,83,45,0.9); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
.cover-for-name { color: ${C.dark}; font-size: 22px; font-weight: 800; margin-top: 2px; }
.cover-plan-badge { background: ${C.dark}; color: ${C.white}; border-radius: 8px; padding: 6px 14px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-align: center; }

/* ── How-to cards ── */
.how-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 0 20px; }
.how-card { background: ${C.card}; border-radius: 12px; padding: 14px 12px; text-align: center; border-top: 3px solid ${C.brand}; }
.how-step-num { background: ${C.brand}; color: ${C.white}; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; margin: 0 auto 8px; }
.how-card-title { font-size: 10.5px; font-weight: 700; color: ${C.dark}; margin-bottom: 4px; }
.how-card-desc { font-size: 9px; color: ${C.sub}; line-height: 1.5; }

/* ── Week overview table ── */
.wov-table { width: 100%; border-collapse: collapse; font-size: 10px; }
.wov-table th { background: ${C.dark}; color: ${C.white}; padding: 8px 12px; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 0.8px; }
.wov-table td { padding: 7px 12px; border-bottom: 1px solid ${C.line}; color: ${C.ink}; }
.wov-table tr:nth-child(even) td { background: ${C.soft}; }
.wov-focus { display: flex; gap: 4px; flex-wrap: wrap; }
.wov-chip { background: ${C.brand}; color: ${C.white}; border-radius: 20px; padding: 1px 7px; font-size: 8px; font-weight: 600; }
.wov-expect { font-size: 9px; color: ${C.sub}; }
`;

// ── Page helpers ──────────────────────────────────────────────────────────

// ── Page 1: Cover ─────────────────────────────────────────────────────────
const coverPage = (plan: DietPlan): string => {
  const coverBowl = img('cover-bowl.png');
  const logoSrc   = img('meridiet-logo-primary.png');
  const heartLeaf = img('heart-leaf.png');

  const profile    = plan.client_profile as Record<string, Record<string, unknown>> | null;
  const clientName = cap(String(plan.client_name ?? profile?.personal_information?.full_name ?? 'Client'));
  const calRange   = plan.calorie_range ?? '';
  const duration   = plan.plan_duration ?? '—';

  // ── CaloriePill ──────────────────────────────────────────────────────────
  const caloriePill = calRange ? `
    <div style="border:1.5px solid ${C.line};border-radius:22px;padding:8px 16px;display:inline-flex;align-items:center;gap:8px;background:${C.white};font-weight:700;color:${C.ink};font-size:14px;font-family:${FONT};">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="${C.brand}" style="flex-shrink:0;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></svg>
      ${esc(calRange)}
    </div>` : '';

  // ── SpreadText: distribute each char with space-between ─────────────────
  const spreadText = (text: string, width: number, style: string) => {
    const spans = text.split('').map((ch) =>
      `<span style="white-space:pre;">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`
    ).join('');
    return `<div style="display:flex;justify-content:space-between;width:${width}px;${style}">${spans}</div>`;
  };

  // ── Leaf SVG ─────────────────────────────────────────────────────────────
  const leafSvg = (size = 20, color = C.brand) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" fill="none" stroke="${color}" stroke-width="2"/></svg>`;

  // ── Cover features (4 items) ──────────────────────────────────────────────
  const features: Array<{ svg: string; title: string; desc: string }> = [
    {
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`,
      title: 'Personalized for You',
      desc:  'A plan tailored to your goals, preferences &amp; lifestyle.',
    },
    {
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.7"><path d="M7 21h10"/><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z"/><path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-3.19 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.4 2.4 0 0 1 .43 3.37l-.1.13"/></svg>`,
      title: 'Balanced Nutrition',
      desc:  'Wholesome, nourishing &amp; sustainable meals.',
    },
    {
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.7"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
      title: 'Visible Results',
      desc:  'Small steps today, lasting transformation tomorrow.',
    },
    {
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.7"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l1.5-3 2 4.5 1.5-6 1.5 4.5h5.27"/></svg>`,
      title: 'Complete Wellness',
      desc:  'Better food, better habits, better you.',
    },
  ];

  const featureItems = features.map((f) => `
    <div style="display:flex;gap:12px;margin-bottom:24px;align-items:center;">
      <div style="width:38px;height:38px;border-radius:50%;background:${C.soft};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${f.svg}
      </div>
      <div>
        <div style="font-weight:800;font-size:14px;color:${C.dark};line-height:1.2;">${esc(f.title)}</div>
        <div style="font-size:12px;color:${C.sub};line-height:1.35;max-width:215px;">${f.desc}</div>
      </div>
    </div>`).join('');

  // ── Bottom feature row (5 items) ──────────────────────────────────────────
  const bottomItems: Array<{ svg: string; a: string; b: string }> = [
    {
      svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
      a: 'Goal-Based', b: 'Approach',
    },
    {
      svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.6"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/></svg>`,
      a: 'Easy &amp; Simple', b: 'Meal Plans',
    },
    {
      svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.6"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6z"/><line x1="6" x2="18" y1="17" y2="17"/></svg>`,
      a: 'Delicious &amp;', b: 'Indian Meals',
    },
    {
      svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.6"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
      a: 'Clean Ingredients', b: 'Better Health',
    },
    {
      svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.6"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>`,
      a: 'Consistent Support', b: 'Every Step',
    },
  ];

  const bottomRow = bottomItems.map((it, i) => `
    <div style="flex:1;text-align:center;padding:0 8px;${i > 0 ? `border-left:1px solid ${C.line};` : ''}">
      <div style="margin-bottom:7px;display:flex;justify-content:center;">${it.svg}</div>
      <div style="font-size:12.5px;font-weight:700;color:${C.dark};line-height:1.25;">${it.a}</div>
      <div style="font-size:12.5px;color:${C.sub};line-height:1.25;">${it.b}</div>
    </div>`).join('');

  // ── Inline SVG helpers for footer ──────────────────────────────────────
  const mailSvg  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
  const phoneSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.96 5.96l.79-.79a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  const globeSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
  const calSvg   = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const heartSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

  return `
<div class="dp-page" style="padding:0;">

  <!-- ① Full-page background image -->
  <div style="position:absolute;top:0;right:0;bottom:0;left:0;background:#eef1e8;overflow:hidden;">
    ${coverBowl ? `<img src="${coverBowl}" alt="" style="position:absolute;top:0;left:0;width:${PAGE_W}px;height:${PAGE_H}px;" />` : ''}
  </div>

  <!-- ② Main content (sits in front of the background) -->
  <div style="position:relative;padding:40px;">

    <!-- Logo -->
    ${logoSrc
      ? `<img src="${logoSrc}" alt="MeriDiet" style="height:120px;width:auto;display:block;" />`
      : `<div style="height:120px;display:flex;align-items:center;font-size:28px;font-weight:900;color:${C.dark};">MeriDiet</div>`}

    <!-- Calorie pill (absolute inside this relative container) -->
    <div style="position:absolute;right:40px;top:44px;">${caloriePill}</div>

    <!-- SpreadText headings -->
    ${spreadText('YOUR PERSONALIZED', 420, `margin-top:42px;font-size:37px;font-weight:800;color:${C.dark};`)}
    ${spreadText('DIET PLAN', 420, `margin-top:2px;font-size:70px;font-weight:900;color:${C.brand};line-height:1.05;`)}

    <!-- Leaf divider -->
    <div style="display:flex;align-items:center;gap:8px;width:420px;margin:16px 0;">
      <div style="flex:1;height:2.5px;background:${C.brand};border-radius:2px;"></div>
      ${leafSvg(20, C.brand)}
      <div style="flex:1;height:2.5px;background:${C.brand};border-radius:2px;"></div>
    </div>

    <!-- Subtitle -->
    <p style="font-size:17px;color:${C.ink};line-height:1.5;max-width:360px;">
      Designed for You.<br/>Backed by Science. Driven by Results.
    </p>

    <!-- Feature list -->
    <div style="margin-top:20px;max-width:380px;">
      ${featureItems}
    </div>

    <!-- Quote card (semi-transparent) -->
    <div style="margin-top:8px;max-width:380px;background:rgba(255,255,255,0.55);border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:center;">
      ${heartLeaf ? `<img src="${heartLeaf}" alt="" style="width:44px;height:44px;flex-shrink:0;" />` : ''}
      <div style="font-size:12px;color:${C.ink};line-height:1.4;">
        This is more than a plan. It's a partnership towards a healthier, happier you.
        <b style="color:${C.brand};">Let's begin this journey together!</b>
      </div>
    </div>
  </div>

  <!-- ③ Cursive quote (absolute on page) -->
  <div style="position:absolute;right:46px;top:150px;font-family:'Segoe Script','Brush Script MT',cursive;color:${C.dark};font-size:24px;text-align:center;line-height:1.3;font-style:italic;">
    Good nutrition<br/>isn't a diet,<br/>it's a lifestyle.
  </div>

  <!-- ④ Bottom feature row -->
  <div style="position:absolute;left:40px;right:40px;bottom:150px;display:flex;padding:16px 10px;border-radius:16px;background:linear-gradient(90deg,rgba(241,241,234,0) 0%,rgba(241,241,234,0.92) 16%,rgba(241,241,234,0.92) 84%,rgba(241,241,234,0) 100%);">
    ${bottomRow}
  </div>

  <!-- ⑤ Prepared-for banner -->
  <div style="position:absolute;left:40px;right:40px;bottom:44px;background:${C.banner};border-radius:12px;padding:16px 22px;color:#fff;display:flex;align-items:center;justify-content:space-between;font-family:${FONT};">
    <div>
      <div style="font-size:11px;opacity:0.85;display:flex;align-items:center;gap:5px;">
        Prepared Especially For ${heartSvg}
      </div>
      <div style="font-size:22px;font-weight:800;">${esc(clientName)}</div>
    </div>
    <div style="width:1px;height:40px;background:rgba(255,255,255,0.3);"></div>
    <div style="text-align:center;">
      <div style="font-size:11px;opacity:0.85;display:flex;align-items:center;justify-content:center;gap:5px;">
        ${calSvg} Plan Duration
      </div>
      <div style="font-size:20px;font-weight:800;">${esc(duration)}</div>
    </div>
    <div style="width:1px;height:40px;background:rgba(255,255,255,0.3);"></div>
    <div style="display:flex;align-items:center;gap:10px;">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.9;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      <div style="text-align:left;">
        <div style="font-size:13px;opacity:0.9;">Your Health.</div>
        <div style="font-size:16px;font-weight:800;">Our Commitment.</div>
      </div>
    </div>
  </div>

  <!-- ⑥ Contact footer (page 01) -->
  <div style="position:absolute;left:40px;right:40px;bottom:16px;display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:${C.sub};font-family:${FONT};">
    <span style="flex:1;display:flex;align-items:center;gap:16px;">
      <a href="mailto:support@meridiet.in" style="display:flex;align-items:center;gap:5px;color:${C.sub};text-decoration:none;">${mailSvg} support@meridiet.in</a>
      <a href="tel:+919609606009" style="display:flex;align-items:center;gap:5px;color:${C.sub};text-decoration:none;">${phoneSvg} +91 960 960 6009</a>
    </span>
    <span style="flex-shrink:0;font-size:12px;font-weight:700;letter-spacing:2px;color:${C.sub};">01</span>
    <span style="flex:1;display:flex;justify-content:flex-end;">
      <a href="https://www.meridiet.com" style="display:flex;align-items:center;gap:5px;color:${C.brand};font-weight:700;text-decoration:none;">${globeSvg} www.meridiet.com</a>
    </span>
  </div>

</div>`;
};

// ── Shared React-style page atoms (used by all rewritten pages) ───────────

const _flameSvg11 = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3C8.928 6.857 9.776 4.946 12 3c.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></svg>`;
const _mailSvg11  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
const _phoneSvg11 = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.96 5.96l.79-.79a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const _globeSvg11 = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

// CaloriePill + Logo header (matches React PageHeader)
const pageHeader = (calorie: string | null): string => {
  const logoSrc = img('meridiet-logo-primary.png');
  const pill = calorie ? `
    <div style="border:1.5px solid ${C.line};border-radius:22px;padding:8px 16px;display:inline-flex;align-items:center;gap:8px;background:${C.white};font-weight:700;color:${C.ink};font-size:14px;">
      <span style="color:${C.brand};">${_flameSvg11}</span> ${esc(calorie)}
    </div>` : '';
  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    ${logoSrc ? `<img src="${logoSrc}" alt="MeriDiet" style="height:46px;width:auto;display:block;" />` : `<span style="font-size:22px;font-weight:900;color:${C.dark};">MeriDiet</span>`}
    ${pill}
  </div>`;
};

// Page footer: tagline banner + contact bar with page number
const pageFooter = (pageNum: number, tagline?: { main: string; sub?: string }): string => {
  const n = String(pageNum).padStart(2, '0');
  return `
  <div style="position:absolute;left:30px;right:30px;bottom:20px;font-family:${FONT};">
    ${tagline ? `
    <div style="background:${C.banner};border-radius:12px;padding:10px 20px;min-height:58px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;text-align:center;color:#fff;margin-bottom:12px;">
      <div style="font-weight:800;font-size:17px;">${esc(tagline.main)}</div>
      ${tagline.sub ? `<div style="font-size:13px;opacity:0.92;margin-top:2px;">${esc(tagline.sub)}</div>` : ''}
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:${C.sub};border-top:1px solid ${C.line};padding-top:8px;">
      <span style="flex:1;display:flex;align-items:center;gap:16px;">
        <a href="mailto:support@meridiet.in" style="display:flex;align-items:center;gap:5px;color:${C.sub};text-decoration:none;"><span style="color:${C.brand};">${_mailSvg11}</span> support@meridiet.in</a>
        <a href="tel:+919609606009" style="display:flex;align-items:center;gap:5px;color:${C.sub};text-decoration:none;"><span style="color:${C.brand};">${_phoneSvg11}</span> +91 960 960 6009</a>
      </span>
      <span style="flex-shrink:0;font-size:12px;font-weight:700;letter-spacing:2px;color:${C.sub};">${n}</span>
      <span style="flex:1;display:flex;justify-content:flex-end;">
        <a href="https://www.meridiet.com" style="display:flex;align-items:center;gap:5px;color:${C.brand};font-weight:700;text-decoration:none;"><span style="color:${C.brand};">${_globeSvg11}</span> www.meridiet.com</a>
      </span>
    </div>
  </div>`;
};

// Title heading (matches React <Title> component)
const pageTitle = (pre: string, accent?: string, size = 34): string =>
  `<div style="margin:16px 0 4px;font-size:${size}px;font-weight:800;color:${C.dark};letter-spacing:-0.5px;line-height:1.1;">
    ${esc(pre)}${accent ? ` <span style="color:${C.brand};">${esc(accent)}</span>` : ''}
  </div>`;

// Section card (matches React <SectionCard>)
const sectionCardNew = (iconSvg: string, title: string, rows: string, extraStyle = ''): string =>
  `<div style="background:${C.card};border-radius:14px;padding:11px 14px;${extraStyle}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="display:flex;align-items:center;flex-shrink:0;">${iconSvg}</span>
      <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">${esc(title)}</div>
    </div>
    ${rows}
  </div>`;

// Info row (matches React <Row> component)
const infoRow = (label: string, value: unknown, iconSvg = ''): string => {
  const val = String(value ?? '').trim() || '—';
  return `<div style="display:flex;align-items:center;font-size:11px;padding:4px 0;line-height:1.3;">
    ${iconSvg ? `<span style="width:15px;display:flex;justify-content:center;color:${C.faint};margin-right:8px;flex-shrink:0;">${iconSvg}</span>` : ''}
    <span style="color:${C.sub};min-width:116px;flex-shrink:0;">${esc(label)}</span>
    <span style="color:${C.sub};margin:0 5px;">:</span>
    <span style="color:${C.ink};font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(val)}</span>
  </div>`;
};

// ── Page 2: Client Profile & Vitals ──────────────────────────────────────
const profilePage = (plan: DietPlan, page: number): string => {
  const cp  = (plan.client_profile ?? {}) as Record<string, Record<string, unknown>>;
  const p   = (cp.personal_information       ?? {}) as Record<string, unknown>;
  const v   = (cp.current_vitals             ?? {}) as Record<string, unknown>;
  const g   = (cp.health_and_fitness_goals   ?? {}) as Record<string, unknown>;
  const lf  = (cp.lifestyle_overview         ?? {}) as Record<string, unknown>;
  const md  = (cp.medical_information        ?? {}) as Record<string, unknown>;
  const di  = (cp.dietary_information        ?? {}) as Record<string, unknown>;

  // ── Small inline SVGs for section card headers (14px) ───────────────────
  const s = (paths: string) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2">${paths}</svg>`;
  const icoUser     = s('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
  const icoPulse    = s('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>');
  const icoBull     = s('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>');
  const icoRun      = s('<circle cx="13" cy="4" r="1"/><path d="M8.71 7.09l3.54 1.42L14 12h4v2h-5l-1.75-3.5L9 12.5l-1 4.5H6l1.25-5.5-2.5-1.5 2.25-3.5z"/>');
  const icoClip     = s('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>');
  const icoFork     = s('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>');

  // ── Tiny row icon helper (11px, faint) ────────────────────────────────────
  const r = (paths: string, filled = false) =>
    `<svg width="11" height="11" viewBox="0 0 24 24" fill="${filled ? C.faint : 'none'}" stroke="${filled ? 'none' : C.faint}" stroke-width="2">${paths}</svg>`;

  const iUser  = r('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
  const iCal   = r('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>');
  const iRuler = r('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>');
  const iPhone = r('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.18h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.71 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.96 5.96l.79-.79a2 2 0 0 1 2.11-.45c.91.35 1.85.58 2.81.71A2 2 0 0 1 22 16.92z"/>');
  const iMail  = r('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>');
  const iPin   = r('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>');
  const iScale = r('<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/>');
  const iFire  = r('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3C8.93 6.86 9.78 4.95 12 3c.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 3z"/>', true);
  const iBolt  = r('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', true);
  const iDumb  = r('<path d="M6 5v14M18 5v14M2 9h4M18 9h4M2 15h4M18 15h4"/>');
  const iSteth = r('<path d="M4.8 2.3A.3.3 0 0 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>');
  const iBrief = r('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>');
  const iSmoke = r('<path d="M18 12h2a2 2 0 1 1 0 4h-2"/><path d="M2 14h16v4H2z"/>');
  const iCheck = r('<polyline points="20 6 9 17 4 12"/>');
  const iPill  = r('<path d="M10.5 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7"/><circle cx="18" cy="18" r="4"/><line x1="15.5" y1="15.5" x2="20.5" y2="20.5"/>');
  const iWarn  = r('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>');
  const iBan   = r('<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>');
  const iPepper= r('<path d="M12 2a7 7 0 0 1 7 7c0 4-3 7-7 7s-7-3-7-7a7 7 0 0 1 7-7z"/>');
  const iHeart = r('<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>', true);
  const iBull2 = r('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>');

  const joinArr = (val: unknown) => toList(val).map(humanize).join(', ') || '—';
  const formId  = String(plan.form_id ?? '0000').padStart(4, '0');

  // ── 6 section cards ────────────────────────────────────────────────────
  const c1 = sectionCardNew(icoUser, 'PERSONAL INFORMATION', [
    infoRow('Full Name',    humanize(p.full_name), iUser),
    infoRow('Age',          p.age ? `${p.age} Years` : null, iCal),
    infoRow('Gender',       humanize(p.gender as string), iUser),
    infoRow('Date of Birth',fmtDate(p.date_of_birth as string), iCal),
    infoRow('Height',       p.height as string, iRuler),
    infoRow('Phone Number', p.phone as string, iPhone),
    infoRow('Email ID',     p.email as string, iMail),
    infoRow('Address',      [p.city, p.state].filter(Boolean).join(', '), iPin),
  ].join(''));

  const c2 = sectionCardNew(icoPulse, 'CURRENT VITALS', [
    infoRow('Weight',          v.weight_kg ? `${v.weight_kg} kg` : null, iScale),
    infoRow('Height',          v.height_cm ? `${v.height_cm} cm` : null, iRuler),
    infoRow('BMI',             v.bmi != null ? String(v.bmi) : null, iScale),
    infoRow('BMI Category',    v.bmi_category as string, iCheck),
    infoRow('BMR',             v.bmr_kcal ? `${v.bmr_kcal} kcal/day` : null, iFire),
    infoRow('TDEE',            v.tdee_kcal ? `${v.tdee_kcal} kcal/day` : null, iBolt),
    infoRow('Activity Level',  humanize(lf.activity_level as string), iDumb),
    infoRow('Digestive Health',humanize(lf.digestive_health as string), iSteth),
  ].join(''));

  const c3 = sectionCardNew(icoBull, 'HEALTH & FITNESS GOALS', [
    infoRow('Primary Goal',   joinArr(g.goals) || humanize(plan.primary_goal), iHeart),
    infoRow('Plan Type',      g.plan_type as string, iCal),
    infoRow('Calorie Target', plan.calorie_range, iFire),
    infoRow('Protein Target', plan.protein_target_g ? `${plan.protein_target_g} g/day` : null, iDumb),
    infoRow('Health Notes',   g.health_notes as string, iCheck),
    infoRow('Final Notes',    g.final_notes as string, iCheck),
  ].join(''));

  const c4 = sectionCardNew(icoRun, 'LIFESTYLE OVERVIEW', [
    infoRow('Work Type',       humanize(lf.work_type as string), iBrief),
    infoRow('Workout Type',    humanize(lf.workout_type as string), iDumb),
    infoRow('Activity Level',  humanize(lf.activity_level as string), iBull2),
    infoRow('Smoke / Alcohol', humanize(lf.smoke_alcohol as string), iSmoke),
    infoRow('Digestive Health',humanize(lf.digestive_health as string), iSteth),
  ].join(''));

  const c5 = sectionCardNew(icoClip, 'MEDICAL INFORMATION', [
    infoRow('Medical Conditions',  none(md.medical_conditions), iPill),
    infoRow('Other Condition',     md.other_condition as string || 'None', iCheck),
    infoRow('On Medication',       humanize(md.on_medication as string), iPill),
    infoRow('Medications',         (md.medications as string) || 'None', iPill),
    infoRow('Allergies / Intol.',  none(md.food_allergies), iWarn),
  ].join(''));

  const c6 = sectionCardNew(icoFork, 'DIETARY INFORMATION', [
    infoRow('Diet Type',          humanize(di.diet_type as string), iCheck),
    infoRow('Cuisine Preference', joinArr(di.cuisine_preference), iPepper),
    infoRow('Favorite Foods',     (di.favorite_foods as string) || '—', iHeart),
    infoRow('Foods Disliked',     (di.foods_dislike as string) || 'None', iBan),
  ].join(''));

  const notes = String(g.final_notes ?? g.health_notes ?? 'Prefers simple, sustainable meals with Indian food options. Motivated to stay consistent and follow the plan.');

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <!-- Title row -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      ${pageTitle('CLIENT PROFILE & VITALS')}
      <p style="font-size:13px;color:${C.sub};margin:2px 0 0;">
        Here's a summary of the information you provided.<br/>
        We'll use this to personalize your plan and track your progress.
      </p>
    </div>
  </div>

  <!-- Date / Client ID chip (absolute top-right) -->
  <div style="position:absolute;right:40px;top:96px;background:${C.soft};border-radius:12px;padding:10px 16px;font-size:11.5px;color:${C.ink};">
    <div>📅 Date of Assessment: <b>${todayFmt()}</b></div>
    <div style="margin-top:6px;">Plan / Client ID: <b>QN-MD-${formId}</b></div>
  </div>

  <!-- Brand accent bar -->
  <div style="width:60px;height:3px;background:${C.brand};border-radius:3px;margin:14px 0 16px;"></div>

  <!-- 2 × 3 section cards -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
    ${c1}${c2}${c3}${c4}${c5}${c6}
  </div>

  <!-- Additional notes + italic quote -->
  <div style="margin-top:16px;display:flex;gap:14px;align-items:stretch;">
    <div style="flex:1.9;background:${C.soft};border-radius:14px;padding:14px 18px;">
      <div style="font-weight:800;font-size:13px;color:${C.dark};margin-bottom:5px;display:flex;align-items:center;gap:8px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
        ADDITIONAL NOTES
      </div>
      <div style="font-size:12px;color:${C.sub};line-height:1.5;">${esc(notes)}</div>
    </div>
    <div style="flex:1;background:${C.soft};border-radius:14px;padding:14px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:${C.brand};">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="${C.brand}" style="opacity:0.55;align-self:flex-start;"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
      <div style="font-family:'Segoe Script','Brush Script MT',cursive;font-style:italic;font-size:14px;line-height:1.4;margin:4px 0;">Your health journey is unique. We're here to support you every step of the way.</div>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="${C.brand}" style="opacity:0.55;align-self:flex-end;"><path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.57-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z"/></svg>
    </div>
  </div>

  ${pageFooter(page, { main: "Let's build a healthier, happier you!", sub: 'Your goals. Our guidance. Real results.' })}
</div>`;
};

// ── Page 3: How to Use + Week Overview ───────────────────────────────────
const overviewPage = (plan: DietPlan, page: number): string => {
  const weeks = (plan.weeks ?? []) as WeekPlan[];

  const howSteps = [
    {
      num: '01', title: 'Read Your Profile',
      desc: 'Review your client profile and vitals on page 2 to understand your starting point.',
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    },
    {
      num: '02', title: 'Follow Weekly Plans',
      desc: 'Each week has 7 days of detailed meals. Follow meal timings for best results.',
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    },
    {
      num: '03', title: 'Track Your Progress',
      desc: 'Log your weight and measurements every week using the Progress Tracker.',
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    },
    {
      num: '04', title: 'Cook & Enjoy',
      desc: 'Use featured recipes for healthy, delicious meal ideas tailored to your plan.',
      svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="1.8"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
    },
  ];

  const tableRows = weeks.map((w, i) => `
    <tr style="${i % 2 === 1 ? `background:${C.soft};` : ''}">
      <td style="padding:7px 10px;font-weight:700;color:${C.brand};font-size:10px;">Week ${w.week}</td>
      <td style="padding:7px 10px;font-weight:600;color:${C.ink};font-size:10px;">${esc(w.title)}</td>
      <td style="padding:7px 10px;"><div style="display:flex;gap:4px;flex-wrap:wrap;">${(w.focus ?? []).map((f) => `<span style="background:${C.brand};color:#fff;border-radius:20px;padding:1px 7px;font-size:8px;font-weight:600;">${esc(f)}</span>`).join('')}</div></td>
      <td style="padding:7px 10px;font-size:9px;color:${C.sub};">${esc(w.what_to_expect ?? '')}</td>
    </tr>`).join('');

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:14px;">
    ${pageTitle('HOW TO USE YOUR', 'PLAN', 28)}
    <p style="font-size:12px;color:${C.sub};margin:3px 0 0;">Follow these 4 simple steps to get the best results from your personalized diet plan.</p>
  </div>
  <div style="width:60px;height:3px;background:${C.brand};border-radius:3px;margin:12px 0 14px;"></div>

  <!-- 4 how-to step cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
    ${howSteps.map((s) => `
      <div style="background:${C.card};border-radius:14px;padding:14px 12px;border-top:3px solid ${C.brand};">
        <div style="width:28px;height:28px;background:${C.brand};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;margin-bottom:10px;">${s.num}</div>
        <div style="margin-bottom:8px;">${s.svg}</div>
        <div style="font-size:12px;font-weight:800;color:${C.dark};margin-bottom:4px;">${esc(s.title)}</div>
        <div style="font-size:9.5px;color:${C.sub};line-height:1.5;">${esc(s.desc)}</div>
      </div>`).join('')}
  </div>

  <!-- Macro summary strip -->
  <div style="background:linear-gradient(135deg,${C.banner},${C.brand});border-radius:12px;padding:14px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
    ${[
      ['Calorie Target', plan.calorie_range ?? '—'],
      ['Protein',        `${plan.protein_target_g ?? '—'}g`],
      ['Carbs',          `${plan.carbs_target_g ?? '—'}g`],
      ['Fat',            `${plan.fat_target_g ?? '—'}g`],
    ].map(([lbl, val]) => `
      <div style="text-align:center;">
        <div style="font-size:9px;color:rgba(255,255,255,0.72);letter-spacing:1px;text-transform:uppercase;">${lbl}</div>
        <div style="font-size:18px;font-weight:800;color:#fff;margin-top:2px;">${val}</div>
      </div>`).join('')}
  </div>

  <!-- Week overview table -->
  <div style="margin-bottom:14px;">
    <div style="font-size:12px;font-weight:800;color:${C.dark};margin-bottom:8px;">Your ${weeks.length}-Week Journey</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:${C.dark};">
          <th style="color:#fff;padding:7px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.8px;width:56px;">Week</th>
          <th style="color:#fff;padding:7px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.8px;">Title</th>
          <th style="color:#fff;padding:7px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.8px;">Focus Areas</th>
          <th style="color:#fff;padding:7px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.8px;">What to Expect</th>
        </tr>
      </thead>
      <tbody style="border:1px solid ${C.line};">${tableRows}</tbody>
    </table>
  </div>

  <!-- Primary goal + diet type + duration row -->
  <div style="background:${C.soft};border-radius:12px;padding:12px 20px;display:flex;align-items:center;gap:0;">
    ${[
      ['Primary Goal',  plan.primary_goal ?? 'Healthy Lifestyle', C.dark],
      ['Diet Type',     cap(plan.diet_type ?? 'Balanced'),         C.brand],
      ['Duration',      plan.plan_duration ?? '—',                 C.dark],
    ].map(([lbl, val, color], i) => `
      ${i > 0 ? `<div style="width:1px;height:36px;background:${C.line};margin:0 20px;"></div>` : ''}
      <div style="flex:1;">
        <div style="font-size:9px;font-weight:700;color:${C.sub};text-transform:uppercase;letter-spacing:1px;">${lbl}</div>
        <div style="font-size:13px;font-weight:800;color:${color};margin-top:2px;">${esc(val)}</div>
      </div>`).join('')}
  </div>

  ${pageFooter(page)}
</div>`;
};

// ── Week pages ────────────────────────────────────────────────────────────
const weekPage = (week: WeekPlan, plan: DietPlan, page: number): string => {
  const mealTag = (label: string, iconName: keyof typeof SVG) =>
    `<div class="meal-tag">${icon(iconName, 8)}${label}</div>`;

  const mealItems = (items: { food: string; quantity: string }[] = []) =>
    items.slice(0, 3).map((it) =>
      `<div class="meal-item">${esc(it.food)} <span class="meal-qty">(${esc(it.quantity)})</span></div>`
    ).join('');

  const dayCards = (week.days ?? []).map((d) => `
    <div class="day-card">
      <div class="day-head">
        <span class="day-head-num">D${d.day}</span>
        <div class="day-head-right">
          ${esc(d.total_kcal ?? 0)} kcal<br />${esc(d.total_protein_g ?? 0)}g protein
        </div>
      </div>
      <div class="day-timing">
        🌅 ${esc(d.meal_timing?.breakfast ?? '8:00 AM')} &nbsp;·&nbsp;
        ☀️ ${esc(d.meal_timing?.lunch ?? '1:00 PM')} &nbsp;·&nbsp;
        🌤 ${esc(d.meal_timing?.snack ?? '5:00 PM')} &nbsp;·&nbsp;
        🌙 ${esc(d.meal_timing?.dinner ?? '8:00 PM')}
      </div>
      <div class="meal-section">
        ${mealTag('Breakfast', 'apple')}
        ${mealItems(d.breakfast)}
      </div>
      <div class="meal-section">
        ${mealTag('Lunch', 'utensils')}
        ${mealItems(d.lunch)}
      </div>
      <div class="meal-section">
        ${mealTag('Snack', 'leaf')}
        ${mealItems(d.snack)}
      </div>
      <div class="meal-section">
        ${mealTag('Dinner', 'star')}
        ${mealItems(d.dinner)}
      </div>
      <div class="day-stats-row">
        <div class="ds"><div class="ds-val">🔥${esc(d.total_kcal ?? '—')}</div><div class="ds-lbl">kcal</div></div>
        <div class="ds"><div class="ds-val">💪${esc(d.total_protein_g ?? '—')}g</div><div class="ds-lbl">protein</div></div>
        <div class="ds"><div class="ds-val">💧${esc(d.water_liters ?? '—')}L</div><div class="ds-lbl">water</div></div>
      </div>
    </div>`).join('');

  const notesHtml = (week.weekly_notes ?? []).map((n) =>
    `<div class="ns-note">${esc(n)}</div>`).join('');

  const swapsHtml = (week.smart_swaps ?? []).map((s) => `
    <div class="swap-row">
      <span class="swap-x">${esc(s.instead_of)}</span>
      ${icon('arrowR', 9, C.brand)}
      <span class="swap-ok">${esc(s.choose)}</span>
    </div>`).join('');

  return `
<div class="dp-page" style="position:relative;overflow:hidden;">
  <!-- Header strip -->
  <div style="padding:20px 30px 0;">
    ${pageHeader(plan.calorie_range)}
  </div>

  <!-- Week banner -->
  <div style="margin:10px 30px 0;background:linear-gradient(135deg,${C.banner} 0%,${C.brand} 100%);border-radius:14px;padding:12px 20px;color:#fff;">
    <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;opacity:0.72;">WEEK ${week.week} · ${esc(plan.client_name ?? 'Your Plan')}</div>
    <div style="font-size:18px;font-weight:900;margin-top:2px;letter-spacing:-0.3px;">${esc(week.title)}</div>
    <div style="font-size:10px;opacity:0.82;margin-top:2px;">${esc(week.description ?? '')}</div>
    <div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap;">
      ${(week.focus ?? []).map((f) => `<span style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.38);border-radius:20px;padding:2px 10px;font-size:8.5px;font-weight:600;color:#fff;">${esc(f)}</span>`).join('')}
    </div>
  </div>

  <!-- Day cards grid -->
  <div class="days-grid">${dayCards}</div>

  <!-- Notes + Smart Swaps -->
  <div class="notes-swaps" style="margin-bottom:62px;">
    <div class="ns-box">
      <div class="ns-title">${icon('check', 10)} Weekly Tips</div>
      ${notesHtml || '<div class="ns-note">Follow your meal plan consistently for best results.</div>'}
    </div>
    <div class="ns-box">
      <div class="ns-title">${icon('swap', 10)} Smart Swaps</div>
      ${swapsHtml || '<div class="ns-note">Stick to the plan — every meal counts.</div>'}
    </div>
  </div>

  ${pageFooter(page)}
</div>`;
};

// ── Recipes page ──────────────────────────────────────────────────────────
const recipesPage = (plan: DietPlan, page: number): string => {
  const recipes = (plan.featured_recipes ?? []) as FeaturedRecipe[];

  const recipeCards = recipes.slice(0, 4).map((r) => `
    <div style="background:${C.card};border-radius:14px;overflow:hidden;">
      <!-- Card header -->
      <div style="background:linear-gradient(90deg,${C.dark},${C.brand});padding:10px 14px;">
        <div style="font-size:13px;font-weight:800;color:#fff;">${esc(r.name)}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.85);margin-top:3px;display:flex;gap:10px;">
          <span>${icon('clock', 9, '#fff')} ${esc(r.cook_time)}</span>
          <span>${icon('utensils', 9, '#fff')} ${esc(r.servings)} serving</span>
          <span>${icon('flame', 9, '#fff')} ${esc(r.calories)} kcal</span>
        </div>
      </div>
      <!-- Ingredients + Steps -->
      <div style="display:grid;grid-template-columns:1fr 1fr;">
        <div style="padding:8px 12px;border-right:1px solid ${C.line};">
          <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${C.brand};margin-bottom:5px;">Ingredients</div>
          ${(r.ingredients ?? []).slice(0, 8).map((i) => `<div style="font-size:9px;color:${C.sub};padding:1.5px 0 1.5px 10px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${C.brand};font-weight:700;">›</span>${esc(i)}</div>`).join('')}
        </div>
        <div style="padding:8px 12px;">
          <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${C.brand};margin-bottom:5px;">Steps</div>
          ${(r.steps ?? []).slice(0, 6).map((s, i) => `<div style="font-size:9px;color:${C.sub};padding:1.5px 0 1.5px 10px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:${C.brand};font-weight:700;">›</span>${i + 1}. ${esc(s)}</div>`).join('')}
        </div>
      </div>
      <!-- Macros strip -->
      <div style="display:flex;gap:5px;padding:6px 12px;background:${C.soft};">
        ${[
          ['Carbs', r.macros?.carbs_g],
          ['Protein', r.macros?.protein_g],
          ['Fat', r.macros?.fat_g],
          ['Fiber', r.macros?.fiber_g],
        ].map(([lbl, val]) => `<span style="background:${C.brand};color:#fff;border-radius:20px;padding:2px 8px;font-size:8.5px;font-weight:600;">${lbl}: ${esc(val ?? '—')}g</span>`).join('')}
      </div>
    </div>`).join('');

  const tips = (plan.general_tips ?? []) as string[];

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:14px;">
    ${pageTitle('FEATURED', 'RECIPES', 28)}
    <p style="font-size:12px;color:${C.sub};margin:3px 0 0;">Healthy, delicious recipes crafted for your diet type and goals.</p>
  </div>
  <div style="width:60px;height:3px;background:${C.brand};border-radius:3px;margin:12px 0 14px;"></div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:${tips.length > 0 ? '12px' : '0'};">
    ${recipeCards}
  </div>

  ${tips.length > 0 ? `
  <div>
    <div style="font-size:11px;font-weight:800;color:${C.dark};margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      General Nutrition Tips
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      ${tips.slice(0, 6).map((t) => `
        <div style="background:${C.soft};border-left:3px solid ${C.brand};border-radius:0 8px 8px 0;padding:6px 10px;font-size:9px;color:${C.sub};line-height:1.4;">${esc(t)}</div>`).join('')}
    </div>
  </div>` : ''}

  ${pageFooter(page, { main: 'Eat clean, live healthy, feel amazing!' })}
</div>`;
};

// ── Hydration + Smart Swaps page ──────────────────────────────────────────
const hydrationPage = (plan: DietPlan, page: number): string => {
  const weeks    = (plan.weeks ?? []) as WeekPlan[];
  const allSwaps = weeks.flatMap((w) => w.smart_swaps ?? []).slice(0, 10);

  const hydSchedule = [
    { time: 'On Waking (6–7 AM)',      amount: '400 ml', reason: 'Kickstart metabolism & rehydrate after sleep' },
    { time: 'Pre-Breakfast (7:30 AM)', amount: '200 ml', reason: 'Aid digestion and nutrient absorption' },
    { time: 'Mid-Morning (10:30 AM)',  amount: '300 ml', reason: 'Maintain energy levels' },
    { time: 'Pre-Lunch (12:30 PM)',    amount: '200 ml', reason: 'Control portion size' },
    { time: 'Post-Lunch (2:30 PM)',    amount: '300 ml', reason: 'Support digestion' },
    { time: 'Evening (5:00 PM)',       amount: '300 ml', reason: 'Refuel after afternoon work' },
    { time: 'Pre-Dinner (7:30 PM)',    amount: '200 ml', reason: 'Control appetite before meals' },
    { time: 'Post-Dinner (9:30 PM)',   amount: '200 ml', reason: 'Aid nighttime recovery' },
  ];

  const hydRows = hydSchedule.map((h, i) => `
    <tr style="${i % 2 === 1 ? `background:${C.soft};` : ''}">
      <td style="padding:6px 10px;font-weight:600;font-size:9.5px;">${esc(h.time)}</td>
      <td style="padding:6px 10px;text-align:center;font-weight:700;color:${C.brand};font-size:9.5px;">${esc(h.amount)}</td>
      <td style="padding:6px 10px;color:${C.sub};font-size:9px;">${esc(h.reason)}</td>
    </tr>`).join('');

  const swapRows = allSwaps.map((s, i) => `
    <tr style="${i % 2 === 1 ? `background:${C.soft};` : ''}">
      <td style="padding:6px 10px;color:${C.red};text-decoration:line-through;font-size:9.5px;">${esc(s.instead_of)}</td>
      <td style="padding:6px 10px;text-align:center;">${icon('arrowR', 10)}</td>
      <td style="padding:6px 10px;color:${C.brand};font-weight:600;font-size:9.5px;">${esc(s.choose)}</td>
    </tr>`).join('');

  const hydTips = [
    'Start your day with 2 glasses of warm water.',
    'Carry a 1-litre bottle and refill it twice daily.',
    'Replace sugary drinks with lemon water or coconut water.',
    'Drink water before meals to reduce overeating.',
    'Herbal teas (green, tulsi) count toward daily intake.',
  ];

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:14px;">
    ${pageTitle('SMART SWAPS &', 'HYDRATION GUIDE', 26)}
    <p style="font-size:12px;color:${C.sub};margin:3px 0 0;">Stay hydrated and make smarter food choices every day.</p>
  </div>
  <div style="width:60px;height:3px;background:${C.brand};border-radius:3px;margin:12px 0 14px;"></div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

    <!-- Hydration column -->
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:32px;height:32px;background:${C.soft};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon('droplets', 16)}</div>
        <div style="font-size:13px;font-weight:800;color:${C.dark};">Daily Hydration Schedule</div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.line};">
        <thead>
          <tr style="background:${C.dark};">
            <th style="color:#fff;padding:6px 10px;text-align:left;font-size:8.5px;font-weight:700;letter-spacing:0.8px;">Time</th>
            <th style="color:#fff;padding:6px 10px;text-align:center;font-size:8.5px;font-weight:700;letter-spacing:0.8px;">Amount</th>
            <th style="color:#fff;padding:6px 10px;text-align:left;font-size:8.5px;font-weight:700;letter-spacing:0.8px;">Why</th>
          </tr>
        </thead>
        <tbody>${hydRows}</tbody>
      </table>
      <div style="margin-top:10px;background:${C.soft};border-radius:10px;padding:10px 14px;">
        <div style="font-size:10px;color:${C.sub};line-height:1.6;font-style:italic;">${esc(plan.hydration_guide ?? 'Aim for 2.5–3.5 litres of water per day. Increase during exercise or hot weather.')}</div>
      </div>
      <!-- Hydration tips -->
      <div style="margin-top:10px;">
        <div style="font-size:10px;font-weight:800;color:${C.dark};margin-bottom:6px;">Hydration Tips</div>
        ${hydTips.map((t) => `
          <div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;">
            <span style="color:${C.brand};font-size:10px;margin-top:1px;">•</span>
            <span style="font-size:9.5px;color:${C.sub};line-height:1.4;">${esc(t)}</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- Smart Swaps column -->
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:32px;height:32px;background:${C.soft};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon('swap', 16)}</div>
        <div style="font-size:13px;font-weight:800;color:${C.dark};">Smart Food Swaps</div>
      </div>
      ${allSwaps.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.line};">
        <thead>
          <tr style="background:${C.dark};">
            <th style="color:#fff;padding:6px 10px;text-align:left;font-size:8.5px;font-weight:700;letter-spacing:0.8px;">Instead of…</th>
            <th style="color:#fff;padding:6px 6px;font-size:8.5px;width:24px;"></th>
            <th style="color:#fff;padding:6px 10px;text-align:left;font-size:8.5px;font-weight:700;letter-spacing:0.8px;">Choose…</th>
          </tr>
        </thead>
        <tbody>${swapRows}</tbody>
      </table>` : `
      <div style="background:${C.card};border-radius:10px;padding:14px;font-size:10px;color:${C.sub};">Smart swap recommendations are included in each weekly meal plan above.</div>`}

      <!-- General tips card -->
      <div style="margin-top:14px;background:${C.card};border-radius:14px;padding:14px;">
        <div style="font-size:11px;font-weight:800;color:${C.dark};margin-bottom:10px;">General Nutrition Reminders</div>
        ${(plan.general_tips as string[] ?? []).slice(0, 5).map((t) => `
          <div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2.5" style="flex-shrink:0;margin-top:2px;"><polyline points="20 6 9 17 4 12"/></svg>
            <span style="font-size:9.5px;color:${C.sub};line-height:1.4;">${esc(t)}</span>
          </div>`).join('')}
      </div>
    </div>

  </div>

  ${pageFooter(page, { main: 'Hydration is the foundation of good health!', sub: 'Drink more water. Feel the difference.' })}
</div>`;
};

// ── Progress Tracker page ─────────────────────────────────────────────────
const progressPage = (plan: DietPlan, page: number): string => {
  const weeks     = (plan.weeks ?? []) as WeekPlan[];
  const weekCount = Math.min(weeks.length || 4, 8);

  const tCell = (txt: string, align = 'center') =>
    `<td style="padding:6px 8px;text-align:${align};font-size:9px;color:${C.sub};border-bottom:1px solid ${C.line};">${txt}</td>`;

  const thCell = (txt: string, align = 'left') =>
    `<th style="background:${C.dark};color:#fff;padding:6px 8px;text-align:${align};font-size:8.5px;font-weight:700;letter-spacing:0.6px;">${txt}</th>`;

  const progressRows = Array.from({ length: weekCount }, (_, i) => `
    <tr style="${i % 2 === 1 ? `background:${C.soft};` : ''}">
      <td style="padding:6px 8px;font-weight:700;font-size:9.5px;color:${C.dark};">Week ${i + 1}</td>
      ${tCell('_____ kg')}${tCell('___ /10')}${tCell('___ /10')}${tCell('___ /10')}${tCell('____%')}
    </tr>`).join('');

  const weightRows = Array.from({ length: Math.min(weekCount, 6) }, (_, i) => `
    <tr style="${i % 2 === 1 ? `background:${C.soft};` : ''}">
      <td style="padding:5px 8px;font-weight:600;font-size:9px;color:${C.dark};">Week ${i + 1}</td>
      ${tCell('_____ kg')}${tCell('± ___kg')}${tCell('', 'left')}
    </tr>`).join('');

  const measurements = ['Chest', 'Waist', 'Hips', 'Arms', 'Thighs'];
  const measureRows = measurements.map((m, i) => `
    <tr style="${i % 2 === 1 ? `background:${C.soft};` : ''}">
      <td style="padding:5px 8px;font-weight:700;font-size:9px;color:${C.dark};">${esc(m)}</td>
      ${tCell('___ cm')}${tCell('___ cm')}${tCell('___ cm')}
    </tr>`).join('');

  const victories = [
    'Better sleep quality', 'More energy at work',
    'Clothes fit better',   'Improved digestion',
    'Fewer cravings',       'Clearer skin',
    'Better focus',         'Reduced bloating',
  ];

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:14px;">
    ${pageTitle('PROGRESS', 'TRACKER', 28)}
    <p style="font-size:12px;color:${C.sub};margin:3px 0 0;">Track your weekly progress and celebrate every milestone — big or small.</p>
  </div>
  <div style="width:60px;height:3px;background:${C.brand};border-radius:3px;margin:12px 0 14px;"></div>

  <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:14px;margin-bottom:12px;">

    <!-- Weekly progress log -->
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:30px;height:30px;background:${C.soft};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon('chart', 14)}</div>
        <div style="font-size:12px;font-weight:800;color:${C.dark};">Weekly Progress Log</div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.line};">
        <thead><tr>
          ${thCell('Week')}${thCell('Weight','center')}${thCell('Energy','center')}${thCell('Sleep','center')}${thCell('Mood','center')}${thCell('Adherence','center')}
        </tr></thead>
        <tbody>${progressRows}</tbody>
      </table>
      <p style="font-size:8px;color:${C.faint};margin-top:4px;">Rate Energy / Sleep / Mood on 1–10 scale. Adherence = % of meals followed.</p>
    </div>

    <!-- Right column: weight + measurements -->
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:30px;height:30px;background:${C.soft};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon('target', 14)}</div>
        <div style="font-size:12px;font-weight:800;color:${C.dark};">Weight Tracker</div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.line};margin-bottom:12px;">
        <thead><tr>
          ${thCell('Week')}${thCell('Weight','center')}${thCell('Change','center')}${thCell('Notes')}
        </tr></thead>
        <tbody>${weightRows}</tbody>
      </table>

      <div style="font-size:12px;font-weight:800;color:${C.dark};margin-bottom:8px;">Body Measurements</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid ${C.line};">
        <thead><tr>
          ${thCell('Area')}${thCell('Start','center')}${thCell('End','center')}${thCell('Diff','center')}
        </tr></thead>
        <tbody>${measureRows}</tbody>
      </table>
    </div>
  </div>

  <!-- Non-scale victories -->
  <div style="background:${C.soft};border-radius:14px;padding:12px 16px;">
    <div style="font-size:11px;font-weight:800;color:${C.dark};margin-bottom:8px;">Non-Scale Victories to Celebrate 🎉</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
      ${victories.map((v) => `
        <div style="background:#fff;border-radius:10px;padding:7px 10px;font-size:9px;color:${C.sub};display:flex;align-items:center;gap:5px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2.5" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
          ${esc(v)}
        </div>`).join('')}
    </div>
  </div>

  ${pageFooter(page, { main: 'Every step forward counts. Keep going!', sub: 'Progress, not perfection.' })}
</div>`;
};

// ── Dietitians page ───────────────────────────────────────────────────────
const dietitiansPage = (plan: DietPlan, page: number): string => {
  const logoSrc = img('meridiet-logo-primary.png');
  const qr      = img('qr-meridiet.png');

  const dietitians = [
    { name: 'Priya Sharma',  spec: 'Clinical Nutritionist',  exp: '8+ years', photo: 'dietitian-priya.jpg' },
    { name: 'Anjali Verma',  spec: 'Sports & Weight Loss',   exp: '6+ years', photo: 'dietitian-anjali.jpg' },
    { name: 'Neha Gupta',    spec: 'Diabetes & Therapeutic', exp: '7+ years', photo: 'dietitian-neha.jpg' },
    { name: 'Rahul Kapoor',  spec: 'Gut Health & Ayurveda',  exp: '5+ years', photo: 'dietitian-rahul.png' },
  ];

  const dtCards = dietitians.map((d) => {
    const photo = img(d.photo);
    return `
    <div style="background:${C.card};border-radius:14px;padding:18px 12px;text-align:center;">
      ${photo
        ? `<img src="${photo}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid ${C.brand};margin:0 auto 10px;display:block;" alt="${esc(d.name)}" />`
        : `<div style="width:72px;height:72px;border-radius:50%;background:${C.soft};border:3px solid ${C.brand};margin:0 auto 10px;display:flex;align-items:center;justify-content:center;">${icon('user', 28, C.brand)}</div>`
      }
      <div style="font-size:13px;font-weight:800;color:${C.dark};margin-bottom:3px;">${esc(d.name)}</div>
      <div style="font-size:10px;color:${C.brand};font-weight:600;margin-bottom:2px;">${esc(d.spec)}</div>
      <div style="font-size:9.5px;color:${C.sub};">${esc(d.exp)} experience</div>
      <div style="margin-top:10px;display:flex;justify-content:center;gap:4px;">
        ${[
          `<svg width="11" height="11" viewBox="0 0 24 24" fill="${C.brand}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
          `<svg width="11" height="11" viewBox="0 0 24 24" fill="${C.brand}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
          `<svg width="11" height="11" viewBox="0 0 24 24" fill="${C.brand}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
          `<svg width="11" height="11" viewBox="0 0 24 24" fill="${C.brand}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
          `<svg width="11" height="11" viewBox="0 0 24 24" fill="${C.brand}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        ].join('')}
      </div>
    </div>`;
  }).join('');

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:14px;">
    ${pageTitle('MEET YOUR EXPERT', 'DIETITIAN TEAM', 26)}
    <p style="font-size:12px;color:${C.sub};margin:3px 0 0;">All plans are reviewed and validated by our certified clinical dietitians.</p>
  </div>
  <div style="width:60px;height:3px;background:${C.brand};border-radius:3px;margin:12px 0 16px;"></div>

  <!-- 4 dietitian cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
    ${dtCards}
  </div>

  <!-- CTA banner + QR -->
  <div style="background:linear-gradient(135deg,${C.banner} 0%,${C.brand} 100%);border-radius:16px;padding:20px 28px;display:flex;align-items:center;gap:24px;margin-bottom:12px;">
    <div style="flex:1;">
      <div style="color:${C.gold};font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px;">Book a Consultation</div>
      <div style="color:#fff;font-size:20px;font-weight:900;line-height:1.2;letter-spacing:-0.3px;">Get Personalized Guidance<br />From Our Experts</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:10px;">
        <a href="tel:${esc(BRAND.supportPhone)}" style="color:rgba(255,255,255,0.85);font-size:10.5px;text-decoration:none;display:flex;align-items:center;gap:6px;">${icon('phone', 11, '#fff')} ${esc(BRAND.supportPhone)}</a>
        <a href="mailto:${esc(BRAND.supportEmail)}" style="color:rgba(255,255,255,0.85);font-size:10.5px;text-decoration:none;display:flex;align-items:center;gap:6px;">${icon('mail', 11, '#fff')} ${esc(BRAND.supportEmail)}</a>
        <a href="https://${esc(BRAND.website)}" style="color:rgba(255,255,255,0.85);font-size:10.5px;text-decoration:none;display:flex;align-items:center;gap:6px;">${icon('globe', 11, '#fff')} ${esc(BRAND.website)}</a>
      </div>
    </div>
    ${qr ? `
    <div style="text-align:center;">
      <img src="${qr}" style="width:88px;height:88px;border-radius:10px;background:#fff;padding:5px;" alt="Scan QR" />
      <div style="color:rgba(255,255,255,0.7);font-size:8.5px;margin-top:5px;">Scan to visit website</div>
    </div>` : ''}
  </div>

  <!-- Disclaimer strip -->
  <div style="background:${C.soft};border-radius:12px;padding:10px 16px;text-align:center;display:flex;align-items:center;gap:12px;">
    ${logoSrc ? `<img src="${logoSrc}" style="height:22px;flex-shrink:0;" alt="${BRAND.name}" />` : ''}
    <div style="font-size:8.5px;color:${C.sub};line-height:1.6;text-align:left;">
      This plan was generated using AI technology and reviewed by certified dietitians. Personalized for
      <strong style="color:${C.dark};">${esc(plan.client_name ?? 'the client')}</strong>. Consult your physician before making major dietary changes.
    </div>
  </div>

  ${pageFooter(page, { main: 'Thank you for choosing MeriDiet!', sub: 'Your health, our mission.' })}
</div>`;
};

// ── HTML wrapper ──────────────────────────────────────────────────────────
const wrapHtml = (plan: DietPlan, pages: string[]): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${PAGE_W}" />
  <title>${esc(BRAND.name)} — Diet Plan — ${esc(plan.client_name ?? '')}</title>
  <style>${CSS}</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;

// ── Full plan export ───────────────────────────────────────────────────────
export const buildDietPlanHtml = (plan: DietPlan): string => {
  const weeks   = (plan.weeks ?? []) as WeekPlan[];
  const recipes = (plan.featured_recipes ?? []) as FeaturedRecipe[];

  // Dynamic page numbers: 1=cover, 2=profile, 3=overview, 4..=weeks, then recipes/hydration/progress/dietitians
  let pg = 3;
  const weekPages    = weeks.map((w) => weekPage(w, plan, ++pg));
  const recipePages  = recipes.length > 0 ? [recipesPage(plan, ++pg)] : [];
  const hydrationPg  = ++pg;
  const progressPg   = ++pg;
  const dietitiansPg = ++pg;

  return wrapHtml(plan, [
    coverPage(plan),
    profilePage(plan, 2),
    overviewPage(plan, 3),
    ...weekPages,
    ...recipePages,
    hydrationPage(plan, hydrationPg),
    progressPage(plan, progressPg),
    dietitiansPage(plan, dietitiansPg),
  ]);
};

// ── Preview export (used by GET /diet-plan/:form_id/preview-html) ─────────
// Shows all pages so the full plan can be previewed in the browser.
export const buildCoverPageHtml = (plan: DietPlan): string =>
  buildDietPlanHtml(plan);
