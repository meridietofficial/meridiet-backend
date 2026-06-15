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
const FONT = "'Liberation Sans',Arial,'Helvetica Neue','Segoe UI',sans-serif";
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
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.day-card {
  background: ${C.card};
  border-radius: 12px;
  padding: 10px;
  border: 1px solid ${C.line};
  font-size: 10px;
}
.day-badge {
  display: inline-block;
  background: ${C.brand};
  color: #fff;
  font-weight: 800;
  font-size: 11px;
  border-radius: 8px;
  padding: 3px 12px;
  margin-bottom: 8px;
}
.meal-row {
  display: flex;
  gap: 6px;
  font-size: 10px;
  line-height: 1.3;
  margin-bottom: 5px;
}
.meal-label {
  width: 70px;
  flex-shrink: 0;
  color: ${C.sub};
  font-weight: 700;
}
.meal-foods { color: ${C.ink}; }
.day-stats {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid ${C.line};
}
.ds-kcal  { font-size: 10px; font-weight: 700; color: ${C.gold}; }
.ds-prot  { font-size: 10px; font-weight: 700; color: ${C.brand}; }

/* ── Weekly notes + swaps ── */
.notes-swaps {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.ns-box {
  background: ${C.card};
  border-radius: 14px;
  padding: 14px 16px;
}
.ns-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: ${C.dark};
  letter-spacing: 0.3px;
  margin-bottom: 10px;
}
.ns-list { margin: 0; padding-left: 16px; font-size: 11px; color: ${C.sub}; line-height: 1.6; }
.ns-expect {
  margin-top: 8px;
  background: ${C.soft};
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 11px;
  color: ${C.ink};
  line-height: 1.4;
}
.swap-header {
  display: flex;
  font-size: 9.5px;
  font-weight: 800;
  color: ${C.brand};
  margin-bottom: 4px;
}
.swap-row {
  display: flex;
  font-size: 10.5px;
  padding: 3px 0;
  border-bottom: 1px solid ${C.line};
  line-height: 1.3;
}
.swap-row:last-child { border-bottom: none; }
.swap-x  { flex: 1; color: #c0392b; text-decoration: line-through; padding-right: 6px; }
.swap-ok { flex: 1; color: ${C.brand}; font-weight: 600; }

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
    { icon: '⏰', title: 'Eat On Time',     desc: 'Follow meal timings consistently for better energy and digestion.' },
    { icon: '💧', title: 'Stay Hydrated',   desc: 'Drink 2.5–3L water daily throughout your transformation journey.' },
    { icon: '👟', title: 'Stay Active',     desc: 'Aim for 7000–10000 steps daily along with light exercise.' },
    { icon: '🌙', title: 'Sleep Well',      desc: 'Maintain 7–8 hours of quality sleep for recovery and fat loss.' },
  ];

  const weekColors = [C.brand, '#2f9e44', '#1b7a39', C.gold];
  const fallbackTitles = ['Reset & Cleanse', 'Balance & Nourish', 'Strength & Sustain', 'Transform & Maintain'];

  const weekCards = weeks.map((w, i) => {
    const sideColor = weekColors[i % 4] ?? C.brand;
    const focusItems = (w.focus ?? ['Balanced meals', 'Hydration', 'Consistency']).slice(0, 4)
      .map((f) => `<li style="margin-bottom:2px;">${esc(f)}</li>`).join('');
    return `
    <div style="display:flex;background:${C.card};border-radius:12px;overflow:hidden;min-height:90px;margin-bottom:10px;">
      <!-- coloured week number sidebar -->
      <div style="width:76px;background:${sideColor};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;padding:8px 0;">
        <div style="font-size:9px;font-weight:700;opacity:0.85;letter-spacing:1px;">WEEK</div>
        <div style="font-size:34px;font-weight:900;line-height:1;">${w.week}</div>
      </div>
      <!-- main content -->
      <div style="flex:1;padding:12px 14px;display:flex;gap:14px;">
        <!-- title + description -->
        <div style="flex:1.4;">
          <div style="font-weight:800;font-size:15px;color:${sideColor};">${esc(w.title ?? fallbackTitles[i] ?? '')}</div>
          <div style="font-size:10.5px;color:${C.sub};line-height:1.4;margin-top:3px;">${esc(w.description ?? 'A structured week to progress your nutrition and habits.')}</div>
        </div>
        <!-- focus -->
        <div style="flex:1;border-left:1px solid ${C.line};padding-left:14px;">
          <div style="font-size:9px;font-weight:800;color:${sideColor};margin-bottom:4px;letter-spacing:0.5px;">FOCUS</div>
          <ul style="margin:0;padding-left:14px;font-size:10px;color:${C.sub};line-height:1.55;">${focusItems}</ul>
        </div>
        <!-- what to expect -->
        <div style="flex:0.9;border-left:1px solid ${C.line};padding-left:14px;">
          <div style="font-size:9px;font-weight:800;color:${C.gold};margin-bottom:4px;letter-spacing:0.5px;">WHAT TO EXPECT</div>
          <div style="font-size:10px;color:${C.sub};line-height:1.4;">${esc(w.what_to_expect ?? 'Steady progress toward your goal.')}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const includeItems = [
    ['📋', 'Daily meal plans'],   ['🏠', 'Indian home-style recipes'],
    ['🥄', 'Portion guidance'],   ['🔥', 'Calorie-aware meals'],
    ['🥗', 'Healthy snack ideas'],['💧', 'Hydration support'],
    ['🔄', 'Smart food swaps'],   ['📈', 'Progress tracking'],
  ];
  const importantNotes = [
    'One cheat meal allowed weekly.',
    'Avoid processed sugar as much as possible.',
    'Portion sizes may vary slightly based on your needs.',
    'Consistency matters more than perfection.',
    'Listen to your body and make mindful choices.',
  ];

  const totalDays = weeks.length ? weeks.length * 7 : 28;

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:10px;">
    ${pageTitle('HOW TO USE', 'THIS PLAN', 28)}
    <p style="font-size:12px;color:${C.sub};margin:2px 0 14px;">Simple steps to follow for the best results</p>
  </div>

  <!-- 4 emoji how-to cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
    ${howSteps.map((s) => `
      <div style="background:${C.card};border-radius:12px;padding:16px 12px;text-align:center;">
        <div style="font-size:28px;margin-bottom:6px;">${s.icon}</div>
        <div style="font-weight:800;font-size:12.5px;color:${C.dark};margin-bottom:4px;">${s.title}</div>
        <div style="font-size:10.5px;color:${C.sub};line-height:1.4;">${s.desc}</div>
      </div>`).join('')}
  </div>

  <!-- Plan overview heading -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:22px;font-weight:800;color:${C.dark};">🌿 ${totalDays}-DAY PLAN OVERVIEW 🌿</div>
    <div style="font-size:11px;color:${C.sub};margin-top:3px;">A structured approach to transform your lifestyle</div>
  </div>

  <!-- Week cards -->
  ${weekCards}

  <!-- What this plan includes + Important notes -->
  <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:14px;margin-top:4px;">
    <!-- includes -->
    <div style="background:${C.card};border-radius:14px;padding:14px 16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:15px;">✅</span>
        <div style="font-size:12.5px;font-weight:800;color:${C.dark};letter-spacing:0.3px;">WHAT THIS PLAN INCLUDES</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;">
        ${includeItems.map(([ico, txt]) => `<div style="font-size:11px;color:${C.ink};display:flex;gap:6px;align-items:flex-start;"><span>${ico}</span>${txt}</div>`).join('')}
      </div>
    </div>
    <!-- important notes -->
    <div style="background:${C.card};border-radius:14px;padding:14px 16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:15px;">ℹ️</span>
        <div style="font-size:12.5px;font-weight:800;color:${C.dark};letter-spacing:0.3px;">IMPORTANT NOTES</div>
      </div>
      <ul style="margin:0;padding-left:16px;font-size:10.5px;color:${C.sub};line-height:1.65;">
        ${importantNotes.map((n) => `<li>${esc(n)}</li>`).join('')}
      </ul>
    </div>
  </div>

  ${pageFooter(page, { main: 'Small healthy choices repeated daily create long-term transformation.' })}
</div>`;
};

// ── Week pages ────────────────────────────────────────────────────────────
const weekPage = (week: WeekPlan, plan: DietPlan, page: number): string => {
  // Comma-joined food names (no quantities) — matches React dishes() helper
  const dishNames = (items: { food: string; quantity: string }[] = []): string =>
    items.map((it) => (it.food ?? '').replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean).join(', ');

  const MEALS = [
    { key: 'breakfast' as const, label: 'Breakfast', icon: '☀️' },
    { key: 'lunch'     as const, label: 'Lunch',     icon: '🍛' },
    { key: 'snack'     as const, label: 'Snack',     icon: '🍎' },
    { key: 'dinner'    as const, label: 'Dinner',    icon: '🌙' },
  ];

  const dayCards = (week.days ?? []).map((d) => {
    const mealRows = MEALS.map((m) => {
      const txt = dishNames((d as unknown as Record<string, { food: string; quantity: string }[]>)[m.key]);
      if (!txt) return '';
      return `
        <div class="meal-row">
          <span class="meal-label">${m.icon} ${m.label}</span>
          <span class="meal-foods">${esc(txt)}</span>
        </div>`;
    }).join('');

    return `
    <div class="day-card">
      <div class="day-badge">DAY ${d.day}</div>
      ${mealRows}
      <div class="day-stats">
        ${d.total_kcal   != null ? `<span class="ds-kcal">🔥 ${esc(d.total_kcal)} kcal</span>` : ''}
        ${d.total_protein_g != null ? `<span class="ds-prot">💪 ${esc(d.total_protein_g)}g Protein</span>` : ''}
      </div>
    </div>`;
  }).join('');

  const days = week.days ?? [];
  const startDay = days[0]?.day ?? 1;
  const endDay   = days[days.length - 1]?.day ?? startDay + days.length - 1;

  const notesHtml = (week.weekly_notes ?? []).length
    ? `<ul class="ns-list">${(week.weekly_notes ?? []).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
    : `<ul class="ns-list"><li>Drink at least 3L water daily.</li><li>Avoid sugary drinks and deep-fried foods.</li><li>Eat mindfully and stop when 80% full.</li></ul>`;

  const whatToExpect = week.what_to_expect
    ? `<div class="ns-expect"><b style="color:${C.brand};">What to expect: </b>${esc(week.what_to_expect)}</div>`
    : '';

  const swaps = (week.smart_swaps ?? []).slice(0, 6);
  const swapsHtml = swaps.length ? `
    <div class="swap-header">
      <span style="flex:1;">INSTEAD OF</span>
      <span style="flex:1;">CHOOSE THIS</span>
    </div>
    ${swaps.map((s) => `
      <div class="swap-row">
        <span class="swap-x">${esc(s.instead_of)}</span>
        <span class="swap-ok">→ ${esc(s.choose)}</span>
      </div>`).join('')}`
    : `<div style="font-size:11px;color:${C.faint};">No swaps listed.</div>`;

  return `
<div class="dp-page" style="padding:30px;position:relative;overflow:hidden;">

  <!-- Header: Logo + Goal chip -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    ${(() => { const logoSrc = img('meridiet-logo-primary.png'); return logoSrc ? `<img src="${logoSrc}" alt="MeriDiet" style="height:46px;width:auto;display:block;" />` : `<span style="font-size:22px;font-weight:900;color:${C.dark};">MeriDiet</span>`; })()}
    <span style="background:${C.soft};color:${C.brand};border-radius:20px;padding:6px 16px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
      🎯 Goal: ${esc(humanize(plan.primary_goal ?? ''))}
    </span>
  </div>

  <!-- Title + subtitle -->
  ${pageTitle(`WEEK ${week.week} –`, 'SAMPLE MEAL PLAN', 28)}
  <p style="font-size:12px;color:${C.sub};margin:2px 0 14px;">
    Days ${startDay}–${endDay} structured nutrition plan${week.title ? ` — ${esc(week.title)}.` : '.'}
  </p>

  <!-- 3-column day cards grid -->
  <div class="days-grid">${dayCards}</div>

  <!-- Weekly Notes + Smart Swaps -->
  <div class="notes-swaps" style="margin-bottom:76px;">
    <div class="ns-box">
      <div class="ns-title"><span style="font-size:15px;">📝</span> WEEKLY NOTES</div>
      ${notesHtml}
      ${whatToExpect}
    </div>
    <div class="ns-box">
      <div class="ns-title"><span style="font-size:15px;">🔄</span> SMART SWAPS</div>
      ${swapsHtml}
    </div>
  </div>

  ${pageFooter(page, { main: "You've got this!", sub: 'Consistency today, transformation tomorrow.' })}
</div>`;
};

// ── Recipes page ──────────────────────────────────────────────────────────
const recipesPage = (plan: DietPlan, page: number): string => {
  const recipes = (plan.featured_recipes ?? []) as FeaturedRecipe[];

  const recipeCards = recipes.slice(0, 4).map((r, idx) => `
    <div style="background:${C.card};border-radius:12px;padding:12px;border:1px solid ${C.line};">
      <!-- numbered badge + name -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="background:${C.brand};color:#fff;border-radius:8px;padding:2px 9px;font-size:12px;font-weight:800;">${String(idx + 1).padStart(2, '0')}</span>
        <span style="font-weight:800;font-size:13px;color:${C.dark};">${esc(r.name)}</span>
      </div>
      <!-- emoji meta row -->
      <div style="display:flex;gap:8px;font-size:10px;color:${C.sub};margin-bottom:8px;">
        ${r.cook_time ? `<span>⏱ ${esc(r.cook_time)}</span>` : ''}
        ${r.servings  ? `<span>🍽 ${esc(r.servings)} Serving${Number(r.servings) !== 1 ? 's' : ''}</span>` : ''}
        ${r.calories  ? `<span>🔥 ${esc(r.calories)} kcal</span>` : ''}
      </div>
      <!-- ingredients + how to make -->
      <div style="display:grid;grid-template-columns:1fr 1.1fr;gap:8px;">
        <div>
          <div style="font-size:9.5px;font-weight:800;color:${C.brand};margin-bottom:3px;">Ingredients</div>
          <ul style="margin:0;padding-left:12px;font-size:9.5px;color:${C.sub};line-height:1.4;">
            ${(r.ingredients ?? []).slice(0, 7).map((i) => `<li>${esc(i)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <div style="font-size:9.5px;font-weight:800;color:${C.brand};margin-bottom:3px;">How to make</div>
          <div style="font-size:9.5px;color:${C.sub};line-height:1.4;">${esc((r.steps ?? []).slice(0, 4).join(' '))}</div>
        </div>
      </div>
      <!-- macros coloured text -->
      ${r.macros ? `
      <div style="display:flex;gap:10px;margin-top:8px;padding-top:6px;border-top:1px solid ${C.line};font-size:9.5px;font-weight:700;">
        <span style="color:${C.gold};">Carbs ${esc(r.macros.carbs_g ?? '—')}g</span>
        <span style="color:${C.brand};">Protein ${esc(r.macros.protein_g ?? '—')}g</span>
        <span style="color:#c0392b;">Fat ${esc(r.macros.fat_g ?? '—')}g</span>
        <span style="color:${C.sub};">Fiber ${esc(r.macros.fiber_g ?? '—')}g</span>
      </div>` : ''}
    </div>`).join('');

  const cookingTips = [
    'Use minimal oil for cooking.',
    'Steam or boil vegetables to retain nutrients.',
    'Choose whole grains over refined grains.',
    'Add more herbs & spices for flavor.',
    'Stay consistent with portion sizes.',
  ];
  const portionGuide = [
    '1 cup cooked grains',
    '1 cup vegetables',
    '1 palm protein (paneer, dal, chana, etc.)',
    '1 thumb healthy fats (nuts, seeds, oil)',
  ];

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:10px;">
    ${pageTitle('FEATURED', 'RECIPES', 28)}
    <p style="font-size:12px;color:${C.sub};margin:2px 0 14px;">Simple, delicious &amp; nutritious recipes from your meal plan.</p>
  </div>

  <!-- 3-column recipe cards grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
    ${recipeCards}
  </div>

  <!-- Cooking Tips + Portion Guide -->
  <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;margin-bottom:76px;">

    <!-- Cooking Tips SectionCard -->
    <div style="background:${C.card};border-radius:14px;padding:14px 16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:15px;">👩‍🍳</span>
        <span style="font-size:13px;font-weight:800;color:${C.dark};letter-spacing:0.3px;">COOKING TIPS</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;">
        ${cookingTips.map((t) => `
          <div style="font-size:11px;color:${C.ink};display:flex;gap:6px;align-items:flex-start;">
            <span style="color:${C.brand};font-weight:700;flex-shrink:0;">✔</span>${esc(t)}
          </div>`).join('')}
      </div>
    </div>

    <!-- Portion Guide SectionCard -->
    <div style="background:${C.card};border-radius:14px;padding:14px 16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:15px;">🍽️</span>
        <span style="font-size:13px;font-weight:800;color:${C.dark};letter-spacing:0.3px;">PORTION GUIDE (1 SERVING)</span>
      </div>
      <ol style="margin:0;padding-left:16px;font-size:11px;color:${C.sub};line-height:1.6;">
        ${portionGuide.map((p) => `<li>${esc(p)}</li>`).join('')}
      </ol>
    </div>

  </div>

  ${pageFooter(page, { main: 'Small steps every day lead to big transformations.', sub: 'Eat clean, stay active, and trust the process.' })}
</div>`;
};

// ── Hydration + Smart Swaps page ──────────────────────────────────────────
const hydrationPage = (plan: DietPlan, page: number): string => {
  const weeks = (plan.weeks ?? []) as WeekPlan[];

  // Deduplicated swaps from all weeks
  const seen = new Set<string>();
  const swaps = weeks
    .flatMap((w) => w.smart_swaps ?? [])
    .filter((sw) => {
      const k = (sw.instead_of ?? '') + (sw.choose ?? '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8);

  const fallbackSwaps = [
    { instead_of: 'Chips',             choose: 'Roasted Makhana' },
    { instead_of: 'Cola / Soft Drinks', choose: 'Lemon / Herbal Water' },
    { instead_of: 'White Bread',        choose: 'Whole Wheat Bread' },
    { instead_of: 'Sugar',              choose: 'Jaggery / Honey' },
    { instead_of: 'Fried Snacks',       choose: 'Roasted Chana' },
    { instead_of: 'Ice Cream',          choose: 'Greek Yogurt / Fruit Bowl' },
    { instead_of: 'White Rice',         choose: 'Brown Rice / Millets' },
  ];

  const displaySwaps = swaps.length ? swaps : fallbackSwaps;

  const schedule = [
    ['🌅', 'After Waking Up',          '1 glass (Warm water)'],
    ['🍳', 'Before Breakfast',          '1 glass'],
    ['💼', 'Mid-Morning',               '1 glass'],
    ['🍱', 'Before Lunch',              '1 glass'],
    ['🕒', 'Mid-Afternoon',             '1 glass'],
    ['🏋️', 'Before Workout / Evening', '1 glass'],
    ['🥗', 'Before Dinner',             '1 glass'],
    ['🌙', 'Before Bed',                '1 glass'],
  ];

  const generalTips = (plan.general_tips as string[] ?? []).slice(0, 5);
  const fallbackTips = [
    'Prioritize protein at every meal.',
    'Include colorful vegetables and fruits.',
    'Stay consistent with meal timings.',
    'Listen to hunger and fullness cues.',
    'Avoid skipping meals.',
  ];
  const tips = generalTips.length ? generalTips : fallbackTips;

  const sectionCard = (icon_: string, title: string, body: string) => `
    <div style="background:${C.card};border-radius:14px;padding:14px 16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:15px;">${icon_}</span>
        <span style="font-size:13px;font-weight:800;color:${C.dark};letter-spacing:0.3px;">${title}</span>
      </div>
      ${body}
    </div>`;

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:10px;">
    ${pageTitle('SMART SWAPS &', 'HYDRATION GUIDE', 26)}
    <p style="font-size:13px;color:${C.sub};margin:2px 0 16px;">Small swaps today. Big transformation tomorrow.</p>
  </div>

  <!-- Two-column main section -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;">

    <!-- LEFT: Smart Swaps SectionCard -->
    ${sectionCard('🔄', 'SMART SWAPS FOR BETTER CHOICES', `
      <!-- header row -->
      <div style="display:flex;font-size:10px;font-weight:800;color:${C.brand};padding:4px 0;border-bottom:1px solid ${C.line};">
        <span style="flex:1;">INSTEAD OF</span>
        <span style="flex:1;">CHOOSE THIS</span>
      </div>
      ${displaySwaps.map((sw) => `
        <div style="display:flex;align-items:center;font-size:11.5px;padding:7px 0;border-bottom:1px solid ${C.line};">
          <span style="flex:1;color:${C.ink};">${esc(sw.instead_of)}</span>
          <span style="color:${C.brand};font-weight:800;margin:0 6px;">→</span>
          <span style="flex:1;color:${C.brand};font-weight:700;">${esc(sw.choose)}</span>
        </div>`).join('')}
    `)}

    <!-- RIGHT: Hydration Guide SectionCard -->
    ${sectionCard('💧', 'HYDRATION GUIDE', `
      <div style="font-size:11.5px;color:${C.sub};margin-bottom:8px;">
        ${esc(plan.hydration_guide ?? 'Water is essential for fat loss, metabolism, digestion and glowing skin.')}
      </div>
      <div style="background:${C.soft};border-radius:8px;padding:8px 12px;text-align:center;font-weight:800;color:${C.brand};font-size:12px;margin-bottom:10px;">
        DAILY GOAL: 8–10 GLASSES (2.5–3 LITRES)
      </div>
      <div style="font-size:10.5px;font-weight:800;color:${C.dark};text-align:center;margin-bottom:6px;">HOW TO SPREAD YOUR WATER INTAKE</div>
      ${schedule.map(([emoji, time, amount]) => `
        <div style="display:flex;align-items:center;font-size:11px;padding:5px 0;border-bottom:1px solid ${C.line};">
          <span style="width:24px;flex-shrink:0;">${emoji}</span>
          <span style="flex:1;color:${C.ink};">${esc(time)}</span>
          <span style="color:${C.sub};">${esc(amount)}</span>
          <span style="margin-left:8px;">🥛</span>
        </div>`).join('')}
    `)}

  </div>

  <!-- Three-column bottom section -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:76px;">

    ${sectionCard('💧', 'BENEFITS OF HYDRATION',
      `<div style="font-size:10.5px;color:${C.sub};line-height:1.7;">
        Boosts Metabolism • Detoxifies Body • Improves Digestion • Enhances Skin Health • Improves Energy Levels
      </div>`)}

    ${sectionCard('🩺', 'GENERAL TIPS',
      `<ul style="margin:0;padding-left:14px;font-size:10px;color:${C.sub};line-height:1.45;">
        ${tips.map((t) => `<li>${esc(t)}</li>`).join('')}
      </ul>`)}

    ${sectionCard('✅', 'HYDRATION CHECKLIST',
      `<div style="font-size:10.5px;color:${C.sub};line-height:1.7;">
        ✓ Drank 8–10 glasses today<br/>
        ✓ Avoided sugary drinks<br/>
        ✓ Included herbal / infused water<br/>
        ✓ Made hydration a daily habit
      </div>`)}

  </div>

  ${pageFooter(page, { main: 'Hydrate well, nourish well, live well!', sub: 'Consistency is your superpower.' })}
</div>`;
};

// ── Progress Tracker page ─────────────────────────────────────────────────
const progressPage = (plan: DietPlan, page: number): string => {
  const weeks     = (plan.weeks ?? []) as WeekPlan[];
  const weekCount = Math.max(weeks.length || 4, 4);
  const wkLabels  = Array.from({ length: weekCount }, (_, i) => `Week ${i + 1}`);

  const th = (txt: string) =>
    `<th style="color:${C.brand};padding:5px 8px;text-align:left;font-size:9.5px;font-weight:700;border-bottom:1px solid ${C.line};">${esc(txt)}</th>`;
  const thC = (txt: string) =>
    `<th style="color:${C.sub};padding:5px 8px;text-align:center;font-size:9.5px;font-weight:700;">${esc(txt)}</th>`;
  const td = (txt: string, align = 'center') =>
    `<td style="padding:6px 8px;text-align:${align};font-size:9px;color:${C.sub};border-bottom:1px solid ${C.line};">${txt}</td>`;

  const trackAreas = ['Followed Meal Plan', 'Stayed Hydrated', 'Worked Out', 'Slept Well', 'Stress Managed'];
  const trackerRows = trackAreas.map((area) => `
    <tr>
      <td style="padding:5px 8px;font-size:10px;color:${C.ink};border-bottom:1px solid ${C.line};">${esc(area)}</td>
      ${wkLabels.map(() => `<td style="text-align:center;padding:5px 4px;font-size:9px;color:${C.faint};border-bottom:1px solid ${C.line};">① ② ③ ④ ⑤</td>`).join('')}
    </tr>`).join('');

  const weightRows = wkLabels.map((w) => `
    <tr>
      <td style="padding:7px 10px;font-size:9.5px;color:${C.ink};border-bottom:1px solid ${C.line};">${esc(w)}</td>
      ${td('____')}${td('____')}${td('____')}${td('____')}
    </tr>`).join('');

  const measurements = ['Weight (kg)', 'Waist (cm)', 'Hips (cm)', 'Chest (cm)', 'Arms (cm)', 'Thighs (cm)'];
  const measureRows = measurements.map((m) => `
    <tr>
      <td style="padding:6px 8px;font-size:9.5px;color:${C.ink};border-bottom:1px solid ${C.line};">${esc(m)}</td>
      ${wkLabels.map(() => td('____')).join('')}
      ${td('____')}
    </tr>`).join('');

  const sectionCard = (icon_: string, title: string, body: string, style = '') => `
    <div style="background:${C.card};border-radius:14px;padding:14px 16px;${style}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:15px;">${icon_}</span>
        <span style="font-size:13px;font-weight:800;color:${C.dark};letter-spacing:0.3px;">${title}</span>
      </div>
      ${body}
    </div>`;

  const nonScaleVictories = [
    '✓ More energy through the day',
    '✓ Better sleep quality',
    '✓ Improved digestion',
    '✓ Clearer skin',
    '✓ Better mood &amp; focus',
    '✓ Reduced cravings',
    '✓ More confidence',
    '✓ Healthy habits stick!',
  ];

  const photoPlaceholders = wkLabels.map((w) => `
    <div style="flex:1;min-height:54px;background:${C.soft};border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:9px;color:${C.faint};">
      📷<span style="margin-top:2px;">${esc(w)}</span>
    </div>`).join('');

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <div style="margin-top:10px;">
    ${pageTitle('PROGRESS TRACKER &', 'MEASUREMENTS', 26)}
    <p style="font-size:12px;color:${C.sub};margin:2px 0 16px;">Track your journey. Celebrate small wins. Stay consistent!</p>
  </div>

  <!-- Top 2-column -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

    <!-- Weekly Progress Tracker SectionCard -->
    ${sectionCard('📊', 'WEEKLY PROGRESS TRACKER', `
      <div style="font-size:10px;color:${C.sub};margin-bottom:8px;">Rate each week on a scale of 1–5 &nbsp;(1 = Needs Improvement, 5 = Excellent)</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            ${th('AREAS')}
            ${wkLabels.map((w) => thC(w)).join('')}
          </tr>
        </thead>
        <tbody>${trackerRows}</tbody>
      </table>
    `)}

    <!-- Weight Tracker SectionCard -->
    ${sectionCard('⚖️', 'WEIGHT TRACKER', `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            ${['Week','Date','Weight (kg)','Change (kg)'].map((h) => `<th style="color:${C.brand};padding:5px 10px;text-align:left;font-size:9.5px;font-weight:700;border-bottom:1px solid ${C.line};">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${weightRows}</tbody>
      </table>
      <div style="margin-top:10px;background:${C.soft};border-radius:8px;padding:8px 10px;font-size:10.5px;color:${C.ink};">
        🏆 Remember: Progress is progress, no matter how small. You're becoming a better version of you!
      </div>
    `)}

  </div>

  <!-- Full-width Measurements Tracker -->
  ${sectionCard('📏', 'MEASUREMENTS TRACKER', `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          ${th('MEASUREMENTS')}
          ${wkLabels.map((w) => thC(w)).join('')}
          ${thC('Change')}
        </tr>
      </thead>
      <tbody>${measureRows}</tbody>
    </table>
  `, 'margin-bottom:14px;')}

  <!-- Bottom 2-column -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:76px;">

    ${sectionCard('⭐', 'NON-SCALE VICTORIES', `
      <div style="font-size:10.5px;color:${C.sub};line-height:1.7;">
        ${nonScaleVictories.join('<br/>')}
      </div>
    `)}

    ${sectionCard('📸', 'PHOTOS SPEAK LOUDER!', `
      <div style="font-size:10.5px;color:${C.sub};margin-bottom:8px;">Click your progress photos once a week and see the amazing transformation.</div>
      <div style="display:flex;gap:8px;">${photoPlaceholders}</div>
    `)}

  </div>

  ${pageFooter(page, { main: "Keep going, you're doing great!", sub: 'Small steps. Consistent choices. Big transformation.' })}
</div>`;
};

// ── Dietitians page ───────────────────────────────────────────────────────
const dietitiansPage = (plan: DietPlan, page: number): string => {
  const dietitians = [
    { name: 'Dt. Priya Sharma', role: 'Clinical Dietitian & Nutritionist', exp: '6+ Years of Experience', sp: 'Weight Management, PCOS, Gut Health',          photo: 'dietitian-priya.jpg' },
    { name: 'Dt. Neha Verma',   role: 'Sports Nutritionist',               exp: '5+ Years of Experience', sp: 'Sports Nutrition, Muscle Gain, Fat Loss',       photo: 'dietitian-neha.jpg' },
    { name: 'Dt. Anjali Mehta', role: 'Holistic Nutritionist',             exp: '7+ Years of Experience', sp: 'Hormonal Health, Thyroid, Weight Loss',         photo: 'dietitian-anjali.jpg' },
    { name: 'Dt. Rahul Gupta',  role: 'Nutrition Consultant',              exp: '4+ Years of Experience', sp: 'Diabetes Care, Heart Health, Family Nutrition',  photo: 'dietitian-rahul.png' },
  ];

  const dtCards = dietitians.map((d) => {
    const photoSrc = img(d.photo);
    const avatar = photoSrc
      ? `<img src="${photoSrc}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:3px solid ${C.brand};margin:0 auto 8px;display:block;" alt="${esc(d.name)}" />`
      : `<div style="width:70px;height:70px;border-radius:50%;margin:0 auto 8px;background:linear-gradient(135deg,${C.brand},#7bd389);display:flex;align-items:center;justify-content:center;font-size:30px;">👩‍⚕️</div>`;
    return `
    <div style="background:${C.card};border-radius:12px;padding:12px;text-align:center;">
      ${avatar}
      <div style="font-weight:800;font-size:12.5px;color:${C.dark};">${esc(d.name)}</div>
      <div style="font-size:10px;color:${C.brand};margin-bottom:6px;">${esc(d.role)}</div>
      <div style="font-size:9.5px;color:${C.sub};line-height:1.4;">✓ ${esc(d.exp)}<br/>✓ ${esc(d.sp)}</div>
    </div>`;
  }).join('');

  const why = [
    ['🎧', 'One-on-one expert attention'],
    ['📋', 'Personalized advice based on progress'],
    ['🎯', 'Faster results with professional support'],
    ['🌱', 'Sustainable habits that last a lifetime'],
    ['📈', 'Track, adjust & achieve your goals'],
  ];

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <!-- Two-line title -->
  <div style="margin:16px 0 2px;font-size:32px;font-weight:800;color:${C.dark};letter-spacing:-0.3px;">WE'RE HERE TO GUIDE YOU,</div>
  <div style="margin:0 0 0;font-size:32px;font-weight:800;color:${C.gold};letter-spacing:-0.3px;">EVERY STEP OF THE WAY.</div>
  <p style="font-size:12.5px;color:${C.sub};margin:10px 0 18px;max-width:520px;">
    At MeriDiet, we believe that the right guidance makes all the difference. Our expert dietitians are here to help you eat better, feel better and live better.
  </p>

  <!-- MEET heading -->
  <div style="text-align:center;font-size:18px;font-weight:800;color:${C.brand};margin:0 0 14px;">🌿 MEET OUR EXPERT DIETITIANS 🌿</div>

  <!-- 4 dietitian cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
    ${dtCards}
  </div>

  <!-- CTA banner -->
  <div style="background:${C.banner};border-radius:14px;padding:18px 22px;color:#fff;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div>
      <div style="font-weight:800;font-size:18px;line-height:1.3;">TAKE PERSONALIZED SESSIONS</div>
      <div style="font-weight:800;font-size:18px;line-height:1.3;">WITH OUR EXPERT DIETITIANS</div>
      <div style="font-size:12px;opacity:0.9;margin-top:4px;">Get clarity. Get guidance. Get results.</div>
    </div>
    <!-- Gold price box -->
    <div style="background:${C.gold};border-radius:12px;padding:12px 20px;text-align:center;color:${C.dark};flex-shrink:0;">
      <div style="font-size:10px;font-weight:700;">ONLY</div>
      <div style="font-size:30px;font-weight:900;line-height:1;">₹2499</div>
      <div style="font-size:9px;font-weight:700;">FOR 2 SESSIONS IN A MONTH</div>
    </div>
  </div>

  <!-- Why take sessions -->
  <div style="text-align:center;font-size:14px;font-weight:800;color:${C.dark};margin:0 0 12px;">WHY TAKE DIETITIAN SESSIONS?</div>
  <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
    ${why.map(([emoji, text]) => `
      <div style="text-align:center;width:130px;">
        <div style="font-size:24px;margin-bottom:4px;">${emoji}</div>
        <div style="font-size:10px;color:${C.sub};line-height:1.35;">${esc(text)}</div>
      </div>`).join('')}
  </div>

  <!-- Bottom soft CTA -->
  <div style="background:${C.soft};border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
    <div>
      <div style="font-weight:800;font-size:13px;color:${C.dark};">🌐 Ready to Transform Your Health?</div>
      <div style="font-size:11px;color:${C.sub};">Book your personalized sessions now on our website</div>
    </div>
    <div style="background:${C.brand};color:#fff;border-radius:20px;padding:8px 22px;font-weight:800;font-size:13px;flex-shrink:0;">www.meridiet.in</div>
  </div>

  <!-- Italic closing quote -->
  <div style="text-align:center;font-style:italic;color:${C.brand};font-size:18px;margin-top:8px;">
    You don't have to do it alone. We're here for you! ♡
  </div>

  ${pageFooter(page)}
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
