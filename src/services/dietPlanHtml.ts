import fs from 'fs';
import path from 'path';
import type { DietPlan, WeekPlan, FeaturedRecipe, MealItem } from '../models/DietPlan';
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
  grid-template-columns: repeat(4, 1fr);
  gap: 9px;
  margin-bottom: 0;
}
.day-card {
  background: ${C.white};
  border-radius: 12px;
  border: 1px solid ${C.line};
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

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

// Inline SVG helper — module-level so all pages can share it
const iSvg = (size: number, path: string, fill: string, stroke = false): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${stroke ? `fill="none" stroke="${fill}" stroke-width="2"` : `fill="${fill}"`} style="flex-shrink:0;">${path}</svg>`;

// Leaf SVG (matches React <Leaf> component) — module-level so all pages can use it
const leafSvg = (size = 20, color = C.brand): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" fill="none" stroke="${color}" stroke-width="2"/></svg>`;

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
  return `<div style="display:flex;align-items:flex-start;font-size:11px;padding:4px 0;line-height:1.3;">
    ${iconSvg ? `<span style="width:15px;display:flex;justify-content:center;color:${C.faint};margin-right:8px;flex-shrink:0;padding-top:1px;">${iconSvg}</span>` : ''}
    <span style="color:${C.sub};min-width:116px;flex-shrink:0;">${esc(label)}</span>
    <span style="color:${C.sub};margin:0 5px;flex-shrink:0;">:</span>
    <span style="color:${C.ink};font-weight:600;word-break:break-word;">${esc(val)}</span>
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

  // Inline SVG icons to match React FA icons (16px, brand color, inside soft circle)
  const stepIcons = [
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="${C.brand}"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${C.brand}" stroke-width="2"><circle cx="12" cy="5" r="1"/><path d="M9 20l3-15"/><path d="M15 20l-3-15"/><path d="M6 8h12"/><path d="M6 16l1.5-3 3 3 3-3 1.5 3"/></svg>`,
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="${C.brand}"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`,
  ];
  const howSteps = [
    { svg: stepIcons[0], title: 'Eat On Time',   desc: 'Follow meal timings consistently for better energy and digestion.' },
    { svg: stepIcons[1], title: 'Stay Hydrated', desc: 'Drink 2.5–3L water daily throughout your transformation journey.' },
    { svg: stepIcons[2], title: 'Stay Active',   desc: 'Aim for 7000–10000 steps daily along with light exercise.' },
    { svg: stepIcons[3], title: 'Sleep Well',    desc: 'Maintain 7–8 hours of quality sleep for recovery and fat loss.' },
  ];

  const weekColors = [C.brand, '#2f9e44', '#1b7a39', C.gold];
  const fallbackTitles = ['Reset & Cleanse', 'Balance & Nourish', 'Strength & Sustain', 'Transform & Maintain'];

  const weekCards = weeks.map((w, i) => {
    const sideColor = weekColors[i % 4] ?? C.brand;
    const focusItems = (w.focus ?? ['Balanced meals', 'Hydration', 'Consistency']).slice(0, 4)
      .map((f) => `<li>${esc(f)}</li>`).join('');
    return `
    <div style="display:flex;background:${C.card};border-radius:12px;overflow:hidden;min-height:74px;">
      <div style="width:70px;background:${sideColor};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;">
        <div style="font-size:9.5px;font-weight:700;opacity:0.85;">WEEK</div>
        <div style="font-size:30px;font-weight:900;line-height:1;">${w.week}</div>
      </div>
      <div style="flex:1;padding:9px 14px;display:flex;gap:14px;">
        <div style="flex:1.4;">
          <div style="font-weight:800;font-size:14px;color:${C.brand};">${esc(w.title ?? fallbackTitles[i] ?? '')}</div>
          <div style="font-size:10.5px;color:${C.sub};line-height:1.35;margin-top:2px;">${esc(w.description ?? 'A structured week to progress your nutrition and habits.')}</div>
        </div>
        <div style="flex:1;border-left:1px solid ${C.line};padding-left:14px;">
          <div style="font-size:9.5px;font-weight:800;color:${C.brand};margin-bottom:3px;">FOCUS</div>
          <ul style="margin:0;padding-left:14px;font-size:10px;color:${C.sub};line-height:1.4;">${focusItems}</ul>
        </div>
        <div style="flex:0.9;border-left:1px solid ${C.line};padding-left:14px;">
          <div style="font-size:9.5px;font-weight:800;color:${C.gold};margin-bottom:3px;">WHAT TO EXPECT</div>
          <div style="font-size:10px;color:${C.sub};line-height:1.35;">${esc(w.what_to_expect ?? 'Steady progress toward your goal.')}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Icon SVGs for "What this plan includes" — matches React FA icons at size 11
  const inclSvg = (path: string) =>
    `<svg width="11" height="11" viewBox="0 0 24 24" fill="${C.brand}" style="flex-shrink:0;">${path}</svg>`;
  const includeItems: [string, string][] = [
    [inclSvg('<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>'), 'Daily meal plans'],
    [inclSvg('<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>'), 'Indian home-style recipes'],
    [inclSvg('<path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m5-9v9m4-9v9m5-9l-2 9"/>'), 'Portion guidance'],
    [inclSvg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>'), 'Calorie-aware meals'],
    [inclSvg('<path d="M12 2a7 7 0 1 0 0 14A7 7 0 0 0 12 2zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 12 4zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>'), 'Healthy snack ideas'],
    [inclSvg('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>'), 'Hydration support'],
    [inclSvg('<path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/>'), 'Smart food swaps'],
    [inclSvg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'), 'Progress tracking'],
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

  ${pageTitle('HOW TO USE', 'THIS PLAN')}
  <p style="font-size:13px;color:${C.sub};margin:2px 0 16px;">Simple steps to follow for the best results</p>

  <!-- 4 icon how-to cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
    ${howSteps.map((s) => `
      <div style="background:${C.card};border-radius:12px;padding:13px 12px;text-align:center;">
        <div style="width:36px;height:36px;border-radius:50%;background:${C.soft};display:flex;align-items:center;justify-content:center;margin:0 auto 8px;">${s.svg}</div>
        <div style="font-weight:800;font-size:12.5px;color:${C.dark};margin-bottom:3px;">${s.title}</div>
        <div style="font-size:10.5px;color:${C.sub};line-height:1.35;">${s.desc}</div>
      </div>`).join('')}
  </div>

  <!-- Plan overview heading with leaf SVGs -->
  <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:14px 0 3px;">
    ${leafSvg(18, C.brand)}
    <span style="font-size:22px;font-weight:800;color:${C.dark};">${totalDays}-DAY PLAN OVERVIEW</span>
    ${leafSvg(18, C.brand)}
  </div>
  <p style="text-align:center;font-size:12px;color:${C.sub};margin:0 0 10px;">A structured approach to transform your lifestyle</p>

  <!-- Week cards — flex column gap 8 -->
  <div style="display:flex;flex-direction:column;gap:8px;">
    ${weekCards}
  </div>

  <!-- What this plan includes + Important notes -->
  <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:14px;margin-top:12px;">
    <div style="background:${C.card};border-radius:14px;padding:11px 14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${C.brand}"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">WHAT THIS PLAN INCLUDES</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;">
        ${includeItems.map(([ico, txt]) => `<div style="font-size:11px;color:${C.ink};display:flex;align-items:center;gap:7px;">${ico}${esc(txt)}</div>`).join('')}
      </div>
    </div>
    <div style="background:${C.card};border-radius:14px;padding:11px 14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${C.brand}"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">IMPORTANT NOTES</div>
      </div>
      <ul style="margin:0;padding-left:16px;font-size:11px;color:${C.sub};line-height:1.55;">
        ${importantNotes.map((n) => `<li>${esc(n)}</li>`).join('')}
      </ul>
    </div>
  </div>

  ${pageFooter(page, { main: 'Small healthy choices repeated daily create long-term transformation.' })}
</div>`;
};

// ── Week pages ────────────────────────────────────────────────────────────
const weekPage = (week: WeekPlan, plan: DietPlan, page: number): string => {
  // 8px icons for day card header / footer
  const fireSvg8    = iSvg(8,  '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>', C.gold);
  const dumbSvg8    = iSvg(8,  '<path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M3 12h3m12 0h3M6 6H3v12h3M21 6h-3v12h3M9 6v12M15 6v12"/>', C.brand, true);
  const dropSvg8    = iSvg(8,  '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>', '#2563eb');

  // 8px meal icons
  const mealSvgs: Record<string, string> = {
    breakfast: iSvg(8, '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>', C.brand, true),
    lunch:     iSvg(8, '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>', C.brand, true),
    snack:     iSvg(8, '<path d="M12 2a7 7 0 1 0 0 14A7 7 0 0 0 12 2z"/><path d="M12 2c1-2 3-2 3-2"/>', C.brand),
    dinner:    iSvg(8, '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>', C.brand),
  };

  const MEALS: { key: 'breakfast' | 'lunch' | 'snack' | 'dinner'; label: string }[] = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'lunch',     label: 'Lunch' },
    { key: 'snack',     label: 'Snack' },
    { key: 'dinner',    label: 'Dinner' },
  ];

  // ── Day cards ─────────────────────────────────────────────────────────
  const dayCards = (week.days ?? []).map((d) => {
    const mealsHtml = MEALS.map((m) => {
      const items: MealItem[] = d[m.key];
      if (!items?.length) return '';
      const time = d.meal_timing?.[m.key];
      const foodRows = items.map((it) => {
        const name = (it.food ?? '').replace(/\s*\([^)]*\)/g, '').trim();
        return `<div style="display:flex;gap:5px;font-size:8.5px;color:${C.ink};line-height:1.3;padding-left:2px;">
          <span style="color:${C.brand};flex-shrink:0;">•</span>
          <span style="flex:1;">${esc(name)}${it.quantity ? `<span style="color:${C.sub};"> — ${esc(it.quantity)}</span>` : ''}</span>
        </div>`;
      }).join('');
      return `<div style="margin-bottom:7px;">
        <div style="display:flex;align-items:center;gap:4px;font-size:8.5px;font-weight:800;color:${C.brand};letter-spacing:0.3px;margin-bottom:2px;">
          ${mealSvgs[m.key]}<span>${m.label.toUpperCase()}</span>
          ${time ? `<span style="margin-left:auto;color:${C.faint};font-weight:700;font-size:7.5px;">${esc(time)}</span>` : ''}
        </div>
        ${foodRows}
      </div>`;
    }).join('');

    return `<div class="day-card">
      <div style="background:${C.brand};color:#fff;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:800;font-size:11px;letter-spacing:0.3px;">DAY ${d.day}</span>
        ${d.total_kcal != null ? `<span style="font-size:9px;font-weight:700;display:flex;align-items:center;gap:3px;">${fireSvg8} ${esc(String(d.total_kcal))} kcal</span>` : ''}
      </div>
      <div style="padding:7px 9px;flex:1;">${mealsHtml}</div>
      <div style="border-top:1px solid ${C.line};padding:5px 9px;display:flex;justify-content:space-between;font-size:9px;font-weight:700;">
        ${d.total_protein_g != null ? `<span style="color:${C.brand};display:flex;align-items:center;gap:3px;">${dumbSvg8} ${esc(String(d.total_protein_g))}g protein</span>` : ''}
        ${d.water_liters    != null ? `<span style="color:#2563eb;display:flex;align-items:center;gap:3px;">${dropSvg8} ${esc(String(d.water_liters))}L water</span>` : ''}
      </div>
    </div>`;
  }).join('');

  const days     = week.days ?? [];
  const startDay = days[0]?.day ?? 1;
  const endDay   = days[days.length - 1]?.day ?? startDay + days.length - 1;

  // ── Macro target pills ────────────────────────────────────────────────
  const macros = [
    { path: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>',         color: C.gold,    label: 'CALORIES', val: plan.calorie_range ? plan.calorie_range.replace('/day', '').trim() : null },
    { path: '<path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M3 12h3m12 0h3M6 6H3v12h3M21 6h-3v12h3M9 6v12M15 6v12"/>', color: C.brand,   label: 'PROTEIN',  val: plan.protein_target_g != null ? `${plan.protein_target_g} g` : null },
    { path: '<path d="M6 2v20M18 2v20M6 7h12M6 12h12M6 17h12"/>',                                                                        color: '#d97706', label: 'CARBS',    val: plan.carbs_target_g   != null ? `${plan.carbs_target_g} g`   : null },
    { path: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><circle cx="17" cy="17" r="1"/>', color: '#dc2626', label: 'FAT',      val: plan.fat_target_g     != null ? `${plan.fat_target_g} g`     : null },
  ].filter((m) => m.val);

  const macrosHtml = macros.length ? `
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      ${macros.map((m) => `
        <div style="flex:1;background:${C.card};border-radius:10px;padding:6px 11px;display:flex;align-items:center;gap:8px;">
          <span style="width:24px;height:24px;border-radius:50%;background:${C.soft};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${m.color};">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="${m.color}">${m.path}</svg>
          </span>
          <div>
            <div style="font-size:8.5px;color:${C.sub};font-weight:700;letter-spacing:0.3px;">${m.label}</div>
            <div style="font-size:11.5px;font-weight:800;color:${C.dark};">${esc(m.val!)}</div>
          </div>
        </div>`).join('')}
    </div>` : '';

  // ── Weekly notes ──────────────────────────────────────────────────────
  const wnotes = week.weekly_notes ?? [];
  const notesListHtml = (wnotes.length ? wnotes : ['Drink at least 3L water daily.', 'Avoid sugary drinks and deep-fried foods.', 'Eat mindfully and stop when 80% full.'])
    .map((n) => `<li>${esc(n)}</li>`).join('');
  const expectHtml = week.what_to_expect
    ? `<div style="margin-top:6px;background:${C.soft};border-radius:8px;padding:6px 9px;font-size:9.5px;color:${C.ink};line-height:1.35;"><b style="color:${C.brand};">What to expect: </b>${esc(week.what_to_expect)}</div>`
    : '';

  // ── Smart swaps ───────────────────────────────────────────────────────
  const swaps = (week.smart_swaps ?? []).slice(0, 5);
  const xCircle9    = iSvg(9,  '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>', '#c0392b');
  const checkCircle9 = iSvg(9, '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>', C.brand);
  const arrow12     = iSvg(12, '<path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>', C.faint);
  const swapsHtml = swaps.length ? `
    <div style="display:flex;font-size:9px;font-weight:800;margin-bottom:4px;">
      <span style="flex:1;color:#c0392b;">INSTEAD OF</span>
      <span style="width:22px;flex-shrink:0;"></span>
      <span style="flex:1;color:${C.brand};">CHOOSE THIS</span>
    </div>
    ${swaps.map((s) => `
      <div style="display:flex;align-items:center;font-size:9.5px;padding:3px 0;border-bottom:1px solid ${C.line};line-height:1.25;">
        <span style="flex:1;color:${C.sub};display:flex;align-items:center;gap:4px;">${xCircle9} ${esc(s.instead_of)}</span>
        <span style="margin:0 5px;flex-shrink:0;">${arrow12}</span>
        <span style="flex:1;color:${C.brand};font-weight:600;display:flex;align-items:center;gap:4px;">${checkCircle9} ${esc(s.choose)}</span>
      </div>`).join('')}`
    : `<div style="font-size:10px;color:${C.faint};">No swaps listed.</div>`;

  // ── Section header icons ──────────────────────────────────────────────
  const noteIcon13 = iSvg(13, '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>', C.brand, true);
  const swapIcon13 = iSvg(13, '<path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/>', C.brand, true);
  const bullseye11 = iSvg(11, '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', C.brand);

  const logoSrc = img('meridiet-logo-primary.png');

  return `
<div class="dp-page" style="padding:30px;position:relative;overflow:hidden;">

  <!-- Header: Logo + Goal chip -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    ${logoSrc ? `<img src="${logoSrc}" alt="MeriDiet" style="height:46px;width:auto;display:block;" />` : `<span style="font-size:22px;font-weight:900;color:${C.dark};">MeriDiet</span>`}
    <span style="background:${C.soft};color:${C.brand};border-radius:20px;padding:3px 11px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:5px;">
      ${bullseye11} Goal: ${esc(humanize(plan.primary_goal ?? ''))}
    </span>
  </div>

  ${pageTitle(`WEEK ${week.week} –`, 'MEAL PLAN')}
  <p style="font-size:12.5px;color:${C.sub};margin:2px 0 10px;">
    Days ${startDay}–${endDay} structured nutrition plan${week.title ? ` — ${esc(week.title)}.` : '.'}
  </p>

  ${macrosHtml}

  <!-- 4-column day cards grid -->
  <div class="days-grid">${dayCards}</div>

  <!-- Weekly Notes + Smart Swaps -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
    <div style="background:${C.card};border-radius:14px;padding:10px 13px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        ${noteIcon13}
        <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">WEEKLY NOTES</div>
      </div>
      <ul style="margin:0;padding-left:15px;font-size:9.5px;color:${C.sub};line-height:1.45;">${notesListHtml}</ul>
      ${expectHtml}
    </div>
    <div style="background:${C.card};border-radius:14px;padding:10px 13px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        ${swapIcon13}
        <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">SMART SWAPS</div>
      </div>
      ${swapsHtml}
    </div>
  </div>

  ${pageFooter(page, { main: "You've got this!", sub: 'Consistency today, transformation tomorrow.' })}
</div>`;
};

// ── Recipes page ──────────────────────────────────────────────────────────
const recipesPage = (plan: DietPlan, page: number): string => {
  const recipes = (plan.featured_recipes ?? []) as FeaturedRecipe[];
  const weeksCount = ((plan.weeks ?? []) as WeekPlan[]).length || 4;

  // ── Meta icons (9px) ──────────────────────────────────────────────────
  const clockSvg9   = iSvg(9, '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', C.brand, true);
  const utenSvg9    = iSvg(9, '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>', C.brand, true);
  const fireSvg9    = iSvg(9, '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>', C.gold);

  // ── Macro icons (9px, brand — all use currentColor via fill) ─────────
  const RECIPE_MACROS: { path: string; label: string; key: keyof FeaturedRecipe['macros'] }[] = [
    { path: '<path d="M6 2v20M18 2v20M6 7h12M6 12h12M6 17h12"/>',                                    label: 'Carbs',   key: 'carbs_g'   },
    { path: '<path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M3 12h3m12 0h3M6 6H3v12h3M21 6h-3v12h3M9 6v12M15 6v12"/>', label: 'Protein', key: 'protein_g' },
    { path: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><circle cx="17" cy="17" r="1"/>', label: 'Fat',     key: 'fat_g'    },
    { path: '<path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2 2 3.3"/>',  label: 'Fiber',   key: 'fiber_g'   },
  ];

  // ── Recipe cards (2-col grid, matches React RecipeCard) ──────────────
  const recipeCards = recipes.slice(0, 4).map((r) => `
    <div style="background:${C.white};border-radius:12px;padding:9px 12px;border:1px solid ${C.line};display:flex;flex-direction:column;">
      <div style="font-weight:800;font-size:13px;color:${C.brand};line-height:1.15;margin-bottom:3px;">${esc(r.name)}</div>
      <div style="display:flex;flex-wrap:nowrap;gap:12px;font-size:9.5px;color:${C.sub};margin-bottom:7px;white-space:nowrap;">
        ${r.cook_time ? `<span style="display:flex;align-items:center;gap:4px;flex-shrink:0;">${clockSvg9} ${esc(r.cook_time)}</span>` : ''}
        ${r.servings  ? `<span style="display:flex;align-items:center;gap:4px;flex-shrink:0;">${utenSvg9} ${esc(r.servings)} Serving${Number(r.servings) !== 1 ? 's' : ''}</span>` : ''}
        ${r.calories  ? `<span style="display:flex;align-items:center;gap:4px;flex-shrink:0;">${fireSvg9} ${esc(r.calories)} kcal</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1.05fr;gap:13px;flex:1;">
        <div>
          <div style="font-size:9.5px;font-weight:800;color:${C.dark};margin-bottom:2px;">Ingredients</div>
          <ul style="margin:0;padding-left:13px;font-size:9px;color:${C.sub};line-height:1.3;">
            ${(r.ingredients ?? []).slice(0, 7).map((i) => `<li>${esc(i)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <div style="font-size:9.5px;font-weight:800;color:${C.dark};margin-bottom:2px;">How to make</div>
          <div style="font-size:9px;color:${C.sub};line-height:1.4;">${esc((r.steps ?? []).slice(0, 6).join(' '))}</div>
        </div>
      </div>
      ${r.macros ? `
      <div style="display:flex;justify-content:space-between;margin-top:7px;padding-top:6px;border-top:1px solid ${C.line};">
        ${RECIPE_MACROS.map(({ path, label, key }) => `
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="width:18px;height:18px;border-radius:50%;background:${C.soft};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${iSvg(9, path, C.brand)}
            </span>
            <div style="line-height:1.05;">
              <div style="font-size:7.5px;color:${C.faint};font-weight:700;">${label}</div>
              <div style="font-size:10px;font-weight:800;color:${C.dark};">${esc(String(r.macros[key] ?? '—'))}g</div>
            </div>
          </div>`).join('')}
      </div>` : ''}
    </div>`).join('');

  // ── Cooking tips & portion guide ──────────────────────────────────────
  const cookingTips = [
    'Use minimal oil for cooking.',
    'Steam or boil vegetables to retain nutrients.',
    'Choose whole grains over refined grains.',
    'Add more herbs & spices for flavor.',
    'Stay consistent with portion sizes.',
  ];
  const checkSvg11  = iSvg(11, '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>', C.brand);
  const heartSvg8   = iSvg(8,  '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>', C.brand);

  const portions: { path: string; text: string }[] = [
    { path: '<path d="M6 2v20M18 2v20M6 7h12M6 12h12M6 17h12"/>',                                                          text: '1 cup cooked grains' },
    { path: '<path d="M12 2a3 3 0 0 0-3 3c0 1.5 1 3 2 4l-4 8h10l-4-8c1-1 2-2.5 2-4a3 3 0 0 0-3-3z"/>',                    text: '1 cup vegetables' },
    { path: '<path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M3 12h3m12 0h3M6 6H3v12h3M21 6h-3v12h3M9 6v12M15 6v12"/>', text: '1 palm protein (paneer, dal, chana, etc.)' },
    { path: '<path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2 2 3.3"/>',                          text: '1 thumb healthy fats (nuts, seeds, oil)' },
  ];

  // ── Header icons ──────────────────────────────────────────────────────
  const chefSvg14   = iSvg(14, '<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6z"/><line x1="6" x2="18" y1="17" y2="17"/>', C.brand, true);
  const scaleSvg13  = iSvg(13, '<path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M7 21H17"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>', C.brand, true);
  const bulbSvg14   = iSvg(14, '<path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2V18H9v-3.8C7.21 13.16 6 11.22 6 9a6 6 0 0 1 6-6z"/>', C.brand, true);

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <!-- Title row: heading + hint box -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
    <div>
      ${pageTitle('FEATURED RECIPES', undefined, 27)}
      <p style="font-size:12.5px;color:${C.sub};margin:2px 0 10px;">Simple, delicious &amp; nutritious recipes from your ${weeksCount}-week meal plan.</p>
    </div>
    <div style="display:flex;align-items:center;gap:8px;background:${C.soft};border-radius:10px;padding:8px 12px;max-width:230px;margin-top:8px;flex-shrink:0;">
      ${bulbSvg14}
      <span style="font-size:10px;color:${C.sub};line-height:1.35;">All recipes are home-style, easy to make &amp; calorie-conscious.</span>
    </div>
  </div>

  <!-- 2-column recipe cards grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    ${recipeCards}
  </div>

  <!-- Cooking Tips + Portion Guide -->
  <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:12px;margin-top:11px;">

    <!-- Cooking Tips -->
    <div style="background:${C.card};border-radius:14px;padding:10px 13px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        ${chefSvg14}
        <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">COOKING TIPS</div>
      </div>
      <div style="display:flex;gap:14px;align-items:stretch;">
        <!-- Tips list -->
        <div style="flex:1;display:flex;flex-direction:column;gap:7px;justify-content:center;">
          ${cookingTips.map((t) => `
            <div style="font-size:9.5px;color:${C.ink};display:flex;align-items:center;gap:7px;white-space:nowrap;">
              ${checkSvg11}${esc(t)}
            </div>`).join('')}
        </div>
        <!-- Remember card -->
        <div style="width:165px;flex-shrink:0;background:${C.soft};border-radius:12px;padding:10px 13px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
          ${leafSvg(15, C.brand)}
          <div style="font-family:'Segoe Script','Brush Script MT',cursive;font-style:italic;font-size:18px;color:${C.brand};margin:0 0 3px;line-height:1;">Remember</div>
          <div style="font-size:9.5px;color:${C.ink};line-height:1.35;">Good food choices today create a healthier you tomorrow.</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:5px;">
            <div style="width:24px;height:1px;background:${C.line};"></div>
            ${heartSvg8}
            <div style="width:24px;height:1px;background:${C.line};"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Portion Guide -->
    <div style="background:${C.card};border-radius:14px;padding:10px 13px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        ${scaleSvg13}
        <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">PORTION GUIDE (1 SERVING)</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${portions.map(({ path, text }) => `
          <div style="font-size:9.5px;color:${C.ink};display:flex;align-items:center;gap:8px;">
            <span style="width:18px;height:18px;border-radius:50%;background:${C.soft};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${iSvg(9, path, C.brand)}
            </span>
            ${esc(text)}
          </div>`).join('')}
      </div>
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

  // ── Section card helper (matches React SectionCard exactly) ────────────
  const sectionCard = (iconSvg: string, title: string, body: string) => `
    <div style="background:${C.card};border-radius:14px;padding:11px 14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:16px;display:flex;align-items:center;">${iconSvg}</span>
        <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">${title}</div>
      </div>
      ${body}
    </div>`;

  // ── Section header icons (14px) ──────────────────────────────────────
  const exchangeSvg14 = iSvg(14, '<path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4"/>', C.brand, true);
  const tintSvg14     = iSvg(14, '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>', C.brand);
  const stethoSvg14   = iSvg(14, '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>', C.brand, true);
  const checkSvg14    = iSvg(14, '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>', C.brand);
  const checkSvg9     = iSvg(9,  '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>', C.brand);

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  ${pageTitle('SMART SWAPS &', 'HYDRATION GUIDE')}
  <p style="font-size:13px;color:${C.sub};margin:2px 0 16px;">Small swaps today. Big transformation tomorrow.</p>

  <!-- Two-column main section -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

    ${sectionCard(exchangeSvg14, 'SMART SWAPS FOR BETTER CHOICES', `
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

    ${sectionCard(tintSvg14, 'HYDRATION GUIDE', `
      <div style="font-size:11.5px;color:${C.sub};margin-bottom:8px;">${esc(plan.hydration_guide ?? 'Water is essential for fat loss, metabolism, digestion and glowing skin.')}</div>
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
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px;">

    ${sectionCard(tintSvg14, 'BENEFITS OF HYDRATION',
      `<div style="display:flex;flex-direction:column;gap:6px;">
        ${['Boosts Metabolism', 'Detoxifies Body', 'Improves Digestion', 'Enhances Skin Health', 'Improves Energy Levels'].map((b) =>
          `<div style="font-size:10.5px;color:${C.sub};display:flex;align-items:center;gap:7px;">${checkSvg9} ${esc(b)}</div>`
        ).join('')}
      </div>`)}

    ${sectionCard(stethoSvg14, 'GENERAL TIPS',
      `<ul style="margin:0;padding-left:14px;font-size:10px;color:${C.sub};line-height:1.45;">
        ${tips.map((t) => `<li>${esc(t)}</li>`).join('')}
      </ul>`)}

    ${sectionCard(checkSvg14, 'HYDRATION CHECKLIST',
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
  const wk        = Array.from({ length: weekCount }, (_, i) => `Week ${i + 1}`);

  // ── Section card helper (matches React SectionCard) ───────────────────
  const sc = (iconSvg: string, title: string, body: string, extraStyle = '') => `
    <div style="background:${C.card};border-radius:14px;padding:11px 13px;${extraStyle}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="display:flex;align-items:center;">${iconSvg}</span>
        <div style="font-size:14px;font-weight:800;color:${C.dark};letter-spacing:0.3px;white-space:nowrap;">${title}</div>
      </div>
      ${body}
    </div>`;

  // ── Brand table header row ────────────────────────────────────────────
  const brandTh = (label: string, align: 'left' | 'center', first: boolean, last: boolean, fs = 9) =>
    `<th style="color:#fff;background:${C.brand};padding:5px ${align === 'left' ? 8 : 3}px;text-align:${align};font-size:${fs}px;white-space:nowrap;${first ? `border-top-left-radius:6px;border-bottom-left-radius:6px;` : ''}${last ? `border-top-right-radius:6px;border-bottom-right-radius:6px;` : ''}">${esc(label)}</th>`;

  const tdCell = (txt: string, align = 'center', pad = '5px 3px') =>
    `<td style="text-align:${align};padding:${pad};color:${C.faint};border-bottom:1px solid ${C.line};font-size:8.5px;">${txt}</td>`;

  // ── Track areas with icons ────────────────────────────────────────────
  const trackAreas = [
    { path: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>', t: 'Followed Meal Plan',  sub: '(80% or more)',       stroke: true  },
    { path: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',                                                        t: 'Stayed Hydrated',    sub: '(8-10 glasses/day)', stroke: false },
    { path: '<path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M3 12h3m12 0h3M6 6H3v12h3M21 6h-3v12h3M9 6v12M15 6v12"/>', t: 'Worked Out', sub: '(3-5 times/week)', stroke: true },
    { path: '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>', t: 'Slept Well', sub: '(7-8 hours/night)', stroke: false },
    { path: '<circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',                      t: 'Stress Managed',     sub: '(Mindful & Positive)', stroke: true },
  ];
  const trackerRows = trackAreas.map(({ path, t, sub, stroke }) => `
    <tr>
      <td style="padding:3.5px 8px;color:${C.ink};white-space:nowrap;border-bottom:1px solid ${C.line};">
        <div style="display:flex;align-items:center;gap:6px;">
          ${iSvg(11, path, C.brand, stroke)}
          <div><div style="font-weight:600;font-size:9px;">${esc(t)}</div><div style="font-size:7.5px;color:${C.faint};">${esc(sub)}</div></div>
        </div>
      </td>
      ${wk.map(() => tdCell('① ② ③ ④ ⑤')).join('')}
    </tr>`).join('');

  const notesGrid = `
    <div style="margin-top:9px;background:${C.soft};border-radius:8px;padding:8px 10px;">
      <div style="font-size:9px;font-weight:800;color:${C.dark};margin-bottom:6px;">NOTES: <span style="font-weight:400;color:${C.sub};">Write down what went well and what you can improve next week.</span></div>
      <div style="display:grid;grid-template-columns:${wk.map(() => '1fr').join(' ')};gap:10px;">
        ${wk.map((w) => `
          <div>
            <div style="font-size:8px;font-weight:700;color:${C.brand};margin-bottom:6px;text-align:center;">${esc(w.toUpperCase())}</div>
            <div style="border-bottom:1px solid ${C.faint};height:11px;"></div>
            <div style="border-bottom:1px solid ${C.faint};height:11px;"></div>
          </div>`).join('')}
      </div>
    </div>`;

  // ── Weight tracker ────────────────────────────────────────────────────
  // Pull starting weight from the stored client_profile (set at plan generation time)
  const cp = (plan.client_profile ?? {}) as Record<string, Record<string, unknown>>;
  const startWeightRaw = cp.current_vitals?.weight_kg;
  const startWeightKg  = startWeightRaw != null ? parseFloat(String(startWeightRaw)) : null;
  const startWeightStr = startWeightKg != null ? `${startWeightKg} kg` : '____';

  const weightRows = wk.map((w, i) => {
    const isFirst     = i === 0;
    const weightCell  = isFirst && startWeightKg != null
      ? `<td style="padding:3px 8px;text-align:center;color:${C.brand};font-weight:700;border-bottom:1px solid ${C.line};font-size:9px;">${esc(startWeightStr)}</td>`
      : `<td style="padding:3px 8px;text-align:center;color:${C.faint};border-bottom:1px solid ${C.line};font-size:9px;">____</td>`;
    const changeCell  = isFirst
      ? `<td style="padding:3px 8px;text-align:center;color:${C.sub};border-bottom:1px solid ${C.line};font-size:9px;">—</td>`
      : `<td style="padding:3px 8px;text-align:center;color:${C.faint};border-bottom:1px solid ${C.line};font-size:9px;">____</td>`;
    return `
    <tr>
      <td style="padding:3px 8px;color:${C.ink};border-bottom:1px solid ${C.line};font-size:9px;">${esc(w)}</td>
      <td style="padding:3px 8px;text-align:center;color:${C.faint};border-bottom:1px solid ${C.line};font-size:9px;">____</td>
      ${weightCell}
      ${changeCell}
    </tr>`;
  }).join('');

  // Graph Y-axis: centre around the client's starting weight, 5 kg steps
  const graphW = 320; const graphH = 150;
  const graphBase   = startWeightKg != null ? Math.ceil(startWeightKg / 5) * 5 + 5 : 90;
  const graphLabels = [0, 1, 2, 3, 4].map((i) => graphBase - i * 5);
  const graphSvg = `
    <svg viewBox="0 0 ${graphW} ${graphH}" preserveAspectRatio="none" style="width:100%;height:104px;display:block;">
      ${[0,1,2,3,4].map((g) => `<line x1="30" y1="${14 + g*28}" x2="314" y2="${14 + g*28}" stroke="${C.line}" stroke-width="1"/>`).join('')}
      <line x1="30" y1="14" x2="30" y2="126" stroke="${C.faint}" stroke-width="1"/>
      <line x1="30" y1="126" x2="314" y2="126" stroke="${C.faint}" stroke-width="1"/>
      ${graphLabels.map((v, g) => `<text x="25" y="${17 + g*28}" text-anchor="end" font-size="8" fill="${C.faint}">${v}</text>`).join('')}
      ${wk.map((w, i) => `<text x="${30 + (i + 0.5) * (284 / wk.length)}" y="139" text-anchor="middle" font-size="8" fill="${C.sub}">${esc(w)}</text>`).join('')}
      <text x="9" y="70" font-size="8" fill="${C.sub}" transform="rotate(-90 9 70)" text-anchor="middle">Weight (kg)</text>
    </svg>`;

  // ── Measurements ──────────────────────────────────────────────────────
  const measures = [
    { path: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12A6 6 0 0 1 12 6z"/>',               t: 'Weight (kg)' },
    { path: '<circle cx="12" cy="12" r="10"/>',                                                                         t: 'Waist (cm)' },
    { path: '<path d="M3 3h18M3 21h18M3 12h18"/>',                                                                     t: 'Hips (cm)' },
    { path: '<path d="M4 4h16v16H4z"/>',                                                                                t: 'Chest (cm)' },
    { path: '<path d="M18 11V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v5m14 0v8H4v-8m14 0H4"/>',                               t: 'Arms (cm)' },
    { path: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>', t: 'Thighs (cm)' },
  ];
  const measureRows = measures.map(({ path, t }) => `
    <tr>
      <td style="padding:5px 6px;color:${C.ink};border-bottom:1px solid ${C.line};white-space:nowrap;">
        <span style="display:inline-flex;align-items:center;gap:6px;">${iSvg(10, path, C.brand)} ${esc(t)}</span>
      </td>
      ${wk.map(() => `<td style="text-align:center;color:${C.faint};border-bottom:1px solid ${C.line};padding:5px 6px;font-size:9px;">____</td>`).join('')}
      <td style="text-align:center;color:${C.faint};border-bottom:1px solid ${C.line};padding:5px 6px;font-size:9px;">____</td>
    </tr>`).join('');

  const howTo = [
    { path: '<circle cx="12" cy="12" r="10"/>',          t: 'Waist',  d: 'Measure around the narrowest part of your waist.' },
    { path: '<path d="M3 3h18M3 21h18M3 12h18"/>',       t: 'Hips',   d: 'Measure around the widest part of your hips.' },
    { path: '<path d="M4 4h16v16H4z"/>',                  t: 'Chest',  d: 'Measure around the fullest part of your chest.' },
    { path: '<path d="M18 11V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v5m14 0v8H4v-8m14 0H4"/>', t: 'Arms', d: 'Measure around the relaxed bicep.' },
    { path: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>', t: 'Thighs', d: 'Measure around the thickest part of your thigh.' },
  ];

  // ── Bottom row ────────────────────────────────────────────────────────
  const victories = [
    'More energy throughout the day', 'Stronger and fitter body',
    'Better sleep quality',           'Better mood &amp; focus',
    'Improved digestion',             'Reduced cravings',
    'Fitting into old clothes',       'More confidence',
    'Clearer skin',                   'Healthy habits stick!',
  ];
  const checkSvg9  = iSvg(9,  '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>', C.brand);
  const camSvg12   = iSvg(12, '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', C.faint, true);

  // ── Header icons ──────────────────────────────────────────────────────
  const chartBarSvg  = iSvg(14, '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>', C.brand, true);
  const weightSvg14  = iSvg(14, '<path d="M6 2h12l1 6H5L6 2zM3 8h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>', C.brand, true);
  const rulerSvg14   = iSvg(14, '<path d="M3 3h18M3 21h18"/><path d="M3 8h4M3 13h4M3 18h4M17 8h4M17 13h4M17 18h4"/>', C.brand, true);
  const rulerHowSvg  = iSvg(14, '<path d="M3 3h18M3 21h18"/>', C.brand, true);
  const starSvg14    = iSvg(14, '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', C.brand);
  const camSvg14     = iSvg(14, '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', C.brand, true);
  const trophySvg12  = iSvg(12, '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>', C.gold, true);

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  ${pageTitle('PROGRESS TRACKER &', 'MEASUREMENTS')}
  <p style="font-size:12.5px;color:${C.sub};margin:2px 0 12px;">Track your journey. Celebrate small wins. Stay consistent!</p>

  <!-- Row 1: Weekly Progress + Weight Tracker -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">

    ${sc(chartBarSvg, 'WEEKLY PROGRESS TRACKER', `
      <div style="font-size:9px;color:${C.sub};margin-bottom:7px;">Rate your progress each week on a scale of 1–5<br/>(1 = Needs Improvement, 5 = Excellent)</div>
      <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
        <thead>
          <tr style="background:${C.brand};">
            ${brandTh('AREAS TO TRACK', 'left', true, false)}
            ${wk.map((w, i) => brandTh(w, 'center', false, i === wk.length - 1)).join('')}
          </tr>
        </thead>
        <tbody>${trackerRows}</tbody>
      </table>
      ${notesGrid}
    `)}

    ${sc(weightSvg14, 'WEIGHT TRACKER', `
      <div style="font-size:9px;color:${C.sub};margin-bottom:7px;">Track your weight trend over ${wk.length} weeks.</div>
      <table style="width:100%;border-collapse:collapse;font-size:9.5px;table-layout:fixed;">
        <thead>
          <tr style="background:${C.brand};">
            ${['Week','Date','Weight (kg)','Change (kg)'].map((h, i) => brandTh(h, i === 0 ? 'left' : 'center', i === 0, i === 3)).join('')}
          </tr>
        </thead>
        <tbody>${weightRows}</tbody>
      </table>
      <div style="margin-top:9px;">
        <div style="font-size:8.5px;font-weight:800;color:${C.dark};text-align:center;margin-bottom:3px;">WEIGHT PROGRESS GRAPH</div>
        ${graphSvg}
      </div>
      <div style="margin-top:8px;background:${C.soft};border-radius:8px;padding:7px 10px;font-size:9.5px;color:${C.ink};display:flex;align-items:center;gap:7px;">
        ${trophySvg12}<span><b style="color:${C.brand};">Remember:</b> Progress is progress, no matter how small. You're becoming a better version of you!</span>
      </div>
    `)}

  </div>

  <!-- Row 2: Measurements + How to Measure -->
  <div style="display:grid;grid-template-columns:3fr 1fr;gap:12px;margin-top:12px;">

    ${sc(rulerSvg14, 'MEASUREMENTS TRACKER', `
      <div style="font-size:9px;color:${C.sub};margin-bottom:8px;">Track your body measurements to see real changes beyond the scale.</div>
      <table style="width:100%;border-collapse:collapse;font-size:9.5px;table-layout:fixed;">
        <colgroup>
          <col style="width:23%;"/>
          ${wk.map(() => `<col style="width:${Math.floor(52 / wk.length)}%;"/>`).join('')}
          <col style="width:25%;"/>
        </colgroup>
        <thead>
          <tr style="background:${C.brand};">
            ${['MEASUREMENTS', ...wk, `Change (W1-W${wk.length})`].map((h, i, arr) =>
              brandTh(h, i === 0 ? 'left' : 'center', i === 0, i === arr.length - 1, 8)).join('')}
          </tr>
        </thead>
        <tbody>${measureRows}</tbody>
      </table>
    `)}

    ${sc(rulerHowSvg, 'HOW TO MEASURE?', `
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${howTo.map(({ path, t, d }) => `
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <span style="width:20px;height:20px;border-radius:50%;background:${C.soft};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${iSvg(10, path, C.brand)}</span>
            <div>
              <div style="font-size:10px;font-weight:800;color:${C.dark};line-height:1.2;">${esc(t)}</div>
              <div style="font-size:9px;color:${C.sub};line-height:1.3;">${esc(d)}</div>
            </div>
          </div>`).join('')}
      </div>
    `)}

  </div>

  <!-- Row 3: Non-Scale Victories + Quote + Photos -->
  <div style="display:grid;grid-template-columns:1.3fr 0.8fr 1.1fr;gap:12px;margin-top:12px;">

    ${sc(starSvg14, 'NON-SCALE VICTORIES', `
      <div style="font-size:8.5px;color:${C.sub};margin-bottom:6px;">Celebrate the changes that truly matter!</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;">
        ${victories.map((v) => `
          <div style="font-size:9px;color:${C.ink};display:flex;align-items:center;gap:6px;">
            ${checkSvg9}${v}
          </div>`).join('')}
      </div>
    `)}

    <!-- Quote card -->
    <div style="background:${C.soft};border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:${C.brand};">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="${C.brand}" style="opacity:0.55;align-self:flex-start;"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
      <div style="font-family:'Segoe Script','Brush Script MT',cursive;font-style:italic;font-size:13.5px;line-height:1.35;margin:3px 0;">It's not about being perfect. It's about being consistent.</div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="${C.brand}" style="opacity:0.55;align-self:flex-end;"><path d="M21 3c-3 0-7 1-7 8v8c0 1.25.757 2.017 2 2h4c1.25 0 2-.75 2-1.972V13c0-1.25-.75-2-2-2h-.75C19.25 8.75 19 7 22 7V4c0-1 0-1-1-1z"/><path d="M9 3c-3 0-7 1-7 8v8c0 1.25.757 2.017 2 2h4c1.25 0 2-.75 2-1.972V13c0-1.25-.75-2-2-2H7.25C7.25 8.75 7 7 10 7V4c0-1 0-1-1-1z"/></svg>
    </div>

    ${sc(camSvg14, 'PHOTOS SPEAK LOUDER!', `
      <div style="font-size:8.5px;color:${C.sub};margin-bottom:7px;">Click your progress photos once a week and see the amazing transformation.</div>
      <div style="display:flex;gap:6px;">
        ${wk.map((w) => `
          <div style="flex:1;height:46px;background:${C.soft};border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:7.5px;color:${C.faint};">
            ${camSvg12}<span>${esc(w)}</span>
          </div>`).join('')}
      </div>
    `)}

  </div>

  ${pageFooter(page, { main: "Keep going, you're doing great!", sub: 'Small steps. Consistent choices. Big transformation.' })}
</div>`;
};

// ── Dietitians page ───────────────────────────────────────────────────────
const dietitiansPage = (plan: DietPlan, page: number): string => {
  const docs = [
    { photo: 'dietitian-priya.jpg',  name: 'Dt. Priya Sharma', role: 'Clinical Dietitian &amp; Nutritionist', pts: ['6+ Years of Experience', 'Specialization: Weight Management, PCOS, Gut Health', 'Helps clients build a healthy relationship with food.'] },
    { photo: 'dietitian-neha.jpg',   name: 'Dt. Neha Verma',   role: 'Sports Nutritionist',                   pts: ['5+ Years of Experience', 'Specialization: Sports Nutrition, Muscle Gain, Fat Loss', 'Passionate about performance fueling and recovery.'] },
    { photo: 'dietitian-anjali.jpg', name: 'Dt. Anjali Mehta', role: 'Holistic Nutritionist',                 pts: ['7+ Years of Experience', 'Specialization: Hormonal Health, Thyroid, Weight Loss', 'Believes in healing through balanced nutrition.'] },
    { photo: 'dietitian-rahul.png',  name: 'Dt. Rahul Gupta',  role: 'Nutrition Consultant',                  pts: ['4+ Years of Experience', 'Specialization: Diabetes Care, Heart Health, Family Nutrition', 'Focused on long-term health and disease reversal.'] },
  ];

  const about = [
    'Personalized diet plans based on your goals',
    'Expert guidance from certified dietitians',
    'Science-backed nutrition for real results',
    'Thousands of success stories across India',
  ];

  // Why section — inline SVG icons (16px) in 38×38 soft circles
  const why = [
    { path: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',  stroke: true,  t: 'One-on-one expert attention' },
    { path: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',                                                                                                                                       stroke: true,  t: 'Personalized advice based on your progress' },
    { path: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',                                                                                                                       stroke: true,  t: 'Faster results with professional support' },
    { path: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" fill="none" stroke="${C.brand}" stroke-width="2"/>',                            stroke: false, t: 'Sustainable habits that last a lifetime' },
    { path: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',                                                                                                                    stroke: true,  t: 'Track, adjust &amp; achieve your goals' },
  ];

  // Dietitian cards — full-width photo banner (110px) + text below
  const checkSvg8 = iSvg(8, '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>', C.brand);

  const dtCards = docs.map((d) => {
    const photoSrc = img(d.photo);
    const photoBanner = photoSrc
      ? `<div style="width:100%;height:110px;background-image:url('${photoSrc}');background-size:cover;background-position:center top;"></div>`
      : `<div style="width:100%;height:110px;background:linear-gradient(135deg,${C.brand},#7bd389);display:flex;align-items:center;justify-content:center;font-size:40px;">👩‍⚕️</div>`;
    return `
    <div style="background:${C.card};border-radius:12px;border:1px solid ${C.line};overflow:hidden;">
      ${photoBanner}
      <div style="padding:9px 10px 10px;">
        <div style="font-weight:800;font-size:12px;color:${C.dark};">${esc(d.name)}</div>
        <div style="font-size:9.5px;color:${C.brand};margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid ${C.line};">${d.role}</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${d.pts.map((p) => `<div style="font-size:8.5px;color:${C.sub};line-height:1.3;display:flex;gap:5px;">${checkSvg8}<span>${esc(p)}</span></div>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('');

  // CTA icons
  const videoSvg30 = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="flex-shrink:0;opacity:0.9;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
  const globeSvg13 = iSvg(13, '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>', C.brand, true);
  const arrowSvg11 = iSvg(11, '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>', '#fff', true);

  // QR code
  const qrSrc = img('qr-meridiet.png');
  const qrEl = qrSrc
    ? `<img src="${qrSrc}" alt="QR — meridiet.in" style="width:62px;height:62px;background:#fff;padding:4px;border-radius:8px;border:1px solid ${C.line};display:block;" />`
    : '';

  // Heart-leaf icon
  const heartLeafSrc = img('heart-leaf.png');
  const heartLeafEl = heartLeafSrc
    ? `<img src="${heartLeafSrc}" alt="" style="width:22px;height:22px;flex-shrink:0;" />`
    : leafSvg(22);

  return `
<div class="dp-page" style="padding:30px;">

  ${pageHeader(plan.calorie_range)}

  <!-- Title row: heading left + About MeriDiet card right -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-top:12px;">
    <div style="flex:1;">
      <div style="font-size:30px;font-weight:800;color:${C.dark};line-height:1.1;">WE'RE HERE TO GUIDE YOU,</div>
      <div style="font-size:30px;font-weight:800;color:${C.gold};line-height:1.1;">EVERY STEP OF THE WAY.</div>
      <p style="font-size:12px;color:${C.sub};margin:12px 0 0;max-width:360px;line-height:1.5;">At MeriDiet, we believe that the right guidance makes all the difference. Our expert dietitians are here to help you eat better, feel better and live better.</p>
    </div>
    <div style="width:250px;flex-shrink:0;background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:13px 15px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
        ${heartLeafEl}
        <div style="font-weight:800;font-size:12.5px;color:${C.dark};">ABOUT MERIDIET</div>
      </div>
      <div style="font-size:10px;color:${C.sub};line-height:1.45;margin-bottom:8px;">MeriDiet is India's trusted online nutrition platform that makes healthy living simple, sustainable and personalized.</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        ${about.map((a) => `
          <div style="font-size:9.5px;color:${C.ink};display:flex;align-items:flex-start;gap:6px;">
            ${iSvg(9, '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>', C.brand)}
            <span style="margin-top:1.5px;">${esc(a)}</span>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- MEET heading with leaf icons -->
  <div style="text-align:center;font-size:16px;font-weight:800;color:${C.brand};margin:16px 0 12px;display:flex;align-items:center;justify-content:center;gap:9px;">
    ${leafSvg(15)} MEET OUR EXPERT DIETITIANS ${leafSvg(15)}
  </div>

  <!-- 4 dietitian cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px;">
    ${dtCards}
  </div>

  <!-- Sessions banner -->
  <div style="background:${C.banner};border-radius:14px;padding:16px 22px;color:#fff;display:flex;justify-content:space-between;align-items:center;margin:14px 0;">
    <div style="display:flex;align-items:center;gap:16px;">
      ${videoSvg30}
      <div>
        <div style="font-weight:800;font-size:17px;">TAKE PERSONALIZED SESSIONS</div>
        <div style="font-weight:800;font-size:17px;">WITH OUR EXPERT DIETITIANS</div>
        <div style="font-size:11.5px;opacity:0.9;margin-top:3px;">Get clarity. Get guidance. Get results.</div>
      </div>
    </div>
    <div style="background:${C.gold};border-radius:12px;padding:12px 18px;color:${C.dark};flex-shrink:0;min-width:190px;">
      <div style="font-size:10px;font-weight:800;letter-spacing:0.5px;margin-bottom:2px;">✦ 1-on-1 Expert Session</div>
      <div style="font-size:13px;font-weight:900;line-height:1.2;margin-bottom:4px;">Start Your Health Journey</div>
      <div style="font-size:8.5px;font-weight:500;opacity:0.8;margin-bottom:8px;line-height:1.3;">Personalised consultation with a verified dietitian</div>
      <div style="border-top:1px solid rgba(0,0,0,0.15);padding-top:7px;">
        <div style="font-size:9px;font-weight:700;opacity:0.75;">Starting from</div>
        <div style="font-size:26px;font-weight:900;line-height:1.1;">₹999</div>
        <div style="font-size:8px;font-weight:600;opacity:0.7;margin-top:1px;">Price set by each dietitian</div>
      </div>
    </div>
  </div>

  <!-- Why take sessions -->
  <div style="text-align:center;font-size:14px;font-weight:800;color:${C.dark};margin:22px 0 16px;">WHY TAKE DIETITIAN SESSIONS?</div>
  <div style="display:flex;justify-content:space-between;margin:0 0 34px;gap:8px;">
    ${why.map(({ path, stroke, t }) => `
      <div style="text-align:center;flex:1;">
        <div style="width:38px;height:38px;border-radius:50%;margin:0 auto 6px;background:${C.soft};display:flex;align-items:center;justify-content:center;">
          ${iSvg(16, path, C.brand, stroke)}
        </div>
        <div style="font-size:9.5px;color:${C.sub};line-height:1.35;">${t}</div>
      </div>`).join('')}
  </div>

  <!-- Bottom CTA with QR -->
  <div style="background:${C.soft};border-radius:12px;padding:13px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
    <div style="flex:1;">
      <div style="font-weight:800;font-size:13px;color:${C.dark};display:flex;align-items:center;gap:7px;">${globeSvg13} Ready to Transform Your Health?</div>
      <div style="font-size:11px;color:${C.sub};margin:2px 0 9px;">Book your personalized sessions now on our website</div>
      <div style="background:${C.brand};color:#fff;border-radius:20px;padding:8px 24px;font-weight:800;font-size:13px;display:inline-flex;align-items:center;gap:7px;">www.meridiet.com ${arrowSvg11}</div>
    </div>
    ${qrEl ? `<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">${qrEl}<div style="font-size:8.5px;color:${C.sub};line-height:1.4;max-width:70px;">Scan to visit meridiet.com</div></div>` : ''}
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
