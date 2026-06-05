// Projects a dietitian's weekly availability (day-of-week -> time slots) onto
// upcoming calendar dates so the frontend can drive slot booking.
//
// The `availability` JSON is a recurring weekly schedule, e.g.
//   { "Monday": ["09:00", "10:00"], "Wed": ["18:00"] }
// We expand it into concrete dates for the next `days` days.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Accept full names ("monday") and 3-letter forms ("mon") in the stored keys
const DAY_INDEX: Record<string, number> = {};
DAY_NAMES.forEach((name, i) => {
  DAY_INDEX[name.toLowerCase()] = i;
  DAY_INDEX[name.slice(0, 3).toLowerCase()] = i;
});

export interface AvailableDate {
  date: string;  // YYYY-MM-DD
  day: string;   // full day name, e.g. "Monday"
  slots: string[];
}

export interface NextAvailable {
  date: string;
  day: string;
  slot: string;
}

const formatYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const buildAvailableDates = (
  availability: Record<string, string[]> | null | undefined,
  days = 14,
): AvailableDate[] => {
  if (!availability) return [];

  // Normalize the weekly schedule to day-index -> slots
  const byIndex = new Map<number, string[]>();
  for (const [key, slots] of Object.entries(availability)) {
    if (!Array.isArray(slots) || slots.length === 0) continue;
    const idx = DAY_INDEX[key.trim().toLowerCase()];
    if (idx === undefined) continue;
    byIndex.set(idx, slots);
  }
  if (byIndex.size === 0) return [];

  const result: AvailableDate[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const slots = byIndex.get(d.getDay());
    if (slots && slots.length > 0) {
      result.push({ date: formatYMD(d), day: DAY_NAMES[d.getDay()], slots });
    }
  }
  return result;
};

export const firstAvailable = (dates: AvailableDate[]): NextAvailable | null => {
  const first = dates[0];
  if (!first || first.slots.length === 0) return null;
  return { date: first.date, day: first.day, slot: first.slots[0] };
};
