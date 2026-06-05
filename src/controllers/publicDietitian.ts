import type { Request, Response } from 'express';
import {
  listPublicDietitians,
  findPublicDietitianById,
  getDistinctSpecializations,
  formatDietitianCard,
  formatDietitianPublic,
  type DietitianListFilters,
} from '../models/Dietitian';
import { getActiveSpecializations } from '../models/Specialization';
import { successResponse, errorResponse } from '../utils/response';

// Map "experience checkbox" buckets (e.g. "0-2", "3-5", "5-10", "10+") to numeric bounds
const parseExperienceBucket = (value: string): { min?: number; max?: number } => {
  const v = value.trim();
  const plus = v.match(/^(\d+)\s*\+$/);
  if (plus) return { min: Number(plus[1]) };
  const range = v.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const single = v.match(/^(\d+)$/);
  if (single) return { min: Number(single[1]) };
  return {};
};

// GET /api/v1/dietitians
// Public, filterable list of approved dietitians (card grid).
export const listDietitians = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 12));

    const str = (v: unknown) => {
      const s = typeof v === 'string' ? v.trim() : '';
      return s.length > 0 ? s : undefined;
    };

    // Experience can arrive as min/max years or as a bucket string (e.g. "5-10", "10+")
    let minExperience: number | undefined;
    let maxExperience: number | undefined;
    if (req.query.min_years != null) minExperience = parseInt(req.query.min_years as string) || undefined;
    if (req.query.max_years != null) maxExperience = parseInt(req.query.max_years as string) || undefined;
    const expBucket = str(req.query.experience);
    if (expBucket && minExperience == null && maxExperience == null) {
      const { min, max } = parseExperienceBucket(expBucket);
      minExperience = min;
      maxExperience = max;
    }

    const sortRaw = str(req.query.sort);
    const allowedSorts = ['top_rated', 'most_reviewed', 'available_now', 'experience'];
    const sort = (sortRaw && allowedSorts.includes(sortRaw) ? sortRaw : undefined) as DietitianListFilters['sort'];

    const availableNow = req.query.available_now === 'true' || req.query.available_now === '1';

    const filters: DietitianListFilters = {
      search: str(req.query.search),
      specialization: str(req.query.specialization),
      gender: str(req.query.gender),
      location: str(req.query.location),
      language: str(req.query.language),
      minExperience,
      maxExperience,
      availableNow,
      sort,
      page,
      limit,
    };

    // How many upcoming days of bookable slots to project (default 14)
    const days = Math.min(60, Math.max(1, parseInt(req.query.days as string) || 14));

    const { rows, total } = await listPublicDietitians(filters);
    const totalPages = Math.ceil(total / limit);

    return successResponse(
      res,
      200,
      'Dietitians fetched successfully',
      rows.map((r) => formatDietitianCard(r, days)),
      { page, limit, total, totalPages },
    );
  } catch (err) {
    console.error('List dietitians error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitians/specializations
// Powers the category/filter tabs. Returns the canonical specialization list
// (with short `label`, `icon`, `image_url`) merged with a live `count` of how
// many approved dietitians offer each. Custom specializations that exist in the
// data but not in the canonical table are appended at the end.
//
// `value` is what you pass to GET /dietitians?specialization=<value>;
// `label` is the short text to show on the tab (e.g. "Thyroid").
//
// Query: ?with_counts=false to skip the join, ?only_active=true to drop count=0 entries.
export const listSpecializations = async (req: Request, res: Response) => {
  try {
    const withCounts = req.query.with_counts !== 'false';
    const onlyActive = req.query.only_active === 'true' || req.query.only_active === '1';

    const canonical = await getActiveSpecializations();

    // value(lower) -> { original name, count of approved dietitians offering it }
    const countMap = new Map<string, { name: string; count: number }>();
    if (withCounts) {
      const distinct = await getDistinctSpecializations();
      for (const d of distinct) countMap.set(d.name.toLowerCase(), { name: d.name, count: Number(d.count) });
    }

    // Track everything already represented (by full value AND short label) so a
    // custom data value like "PCOS" doesn't duplicate the canonical
    // "PCOS / Hormonal Imbalance" whose label is also "PCOS".
    const seen = new Set<string>();
    for (const s of canonical) {
      seen.add(s.value.toLowerCase());
      seen.add(s.label.toLowerCase());
    }

    const result = canonical.map((s) => ({
      value: s.value,
      label: s.label,
      slug: s.slug,
      icon: s.icon,
      image_url: s.image_url,
      count: countMap.get(s.value.toLowerCase())?.count ?? 0,
      is_active: Boolean(s.is_active),
      is_custom: false,
    }));

    // Append custom specializations present in the data but not already represented
    if (withCounts) {
      for (const [valueLower, { name, count }] of countMap) {
        if (seen.has(valueLower)) continue;
        seen.add(valueLower);
        result.push({
          value: name,
          label: name,
          slug: valueLower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          icon: null,
          image_url: null,
          count,
          is_active: true,
          is_custom: true,
        });
      }
    }

    const data = onlyActive ? result.filter((s) => s.count > 0) : result;

    return successResponse(res, 200, 'Specializations fetched successfully', data);
  } catch (err) {
    console.error('List specializations error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitians/:id
// Public profile of a single approved dietitian (View Profile page).
export const getPublicDietitian = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return errorResponse(res, 400, 'Invalid dietitian id');

    const dietitian = await findPublicDietitianById(id);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian not found');

    return successResponse(res, 200, 'Dietitian fetched successfully', formatDietitianPublic(dietitian));
  } catch (err) {
    console.error('Get public dietitian error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
