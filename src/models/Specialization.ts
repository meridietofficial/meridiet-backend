import { query } from '../config/database';

export interface Specialization {
  id: number;
  value: string;       // full canonical name (DB value + filter value)
  label: string;       // short display name for filter tabs
  slug: string;
  icon: string | null; // icon key/name (frontend maps to an icon)
  image_url: string | null;
  sort_order: number;
  is_active: number;
}

// All active specializations, in display order
export const getActiveSpecializations = async () => {
  return query<Specialization>(
    `SELECT id, value, label, slug, icon, image_url, sort_order, is_active
       FROM specializations
      WHERE is_active = 1
      ORDER BY sort_order ASC, label ASC`,
  );
};
