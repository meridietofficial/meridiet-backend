const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+05:30
const pad2 = (n: number) => String(n).padStart(2, '0');

// Convert a UTC Date (from MySQL DATETIME) to an IST string for API responses
export const toIST = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${pad2(ist.getUTCMonth() + 1)}-${pad2(ist.getUTCDate())}T${pad2(ist.getUTCHours())}:${pad2(ist.getUTCMinutes())}:${pad2(ist.getUTCSeconds())}+05:30`;
};

// Convert an IST date string (YYYY-MM-DD from the admin UI) to a UTC DATETIME
// string for use in MySQL >= / <= / BETWEEN filters.
export const istToUTC = (dateStr: string, endOfDay: boolean): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const h = endOfDay ? 23 : 0, mn = endOfDay ? 59 : 0, sc = endOfDay ? 59 : 0;
  const utcMs = Date.UTC(y, m - 1, d, h, mn, sc) - IST_OFFSET_MS;
  const u = new Date(utcMs);
  return `${u.getUTCFullYear()}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())} ${pad2(u.getUTCHours())}:${pad2(u.getUTCMinutes())}:${pad2(u.getUTCSeconds())}`;
};
