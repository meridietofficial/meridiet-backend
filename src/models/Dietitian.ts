import { query, execute } from '../config/database';
import { buildAvailableDates, firstAvailable } from '../utils/availability';

export interface DegreeEntry {
  degree: string;
  institute: string;
  year: string | null;
}

export interface AwardEntry {
  title: string;
  organization: string;
  year: string | null;
}

export interface Dietitian {
  id: number;
  user_id: number;
  state: string;
  city: string;
  registration_number: string | null;
  experience: string;
  specialization: string[] | string | null;
  date_of_birth: string | null;
  gender: string | null;
  bio: string | null;
  languages: string[] | string | null;
  services: string[] | string | null;
  degrees: DegreeEntry[] | string | null;
  awards: AwardEntry[] | string | null;
  availability: Record<string, string[]> | string | null;
  profile_photo: string | null;
  degree_certificate: string | null;
  registration_certificate: string | null;
  id_proof: string | null;
  experience_certificate: string | null;
  is_verified: boolean;
  is_online: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDietitianData {
  user_id: number;
  state: string;
  city: string;
  registration_number: string | null;
  experience: string;
  specialization: string[];
  degrees?: DegreeEntry[] | null;
  date_of_birth?: string | null;
  gender?: string | null;
  bio?: string | null;
  languages?: string[] | null;
  services?: string[] | null;
  awards?: AwardEntry[] | null;
  availability?: Record<string, string[]> | null;
  profile_photo?: string | null;
  degree_certificate?: string | null;
  registration_certificate?: string | null;
  id_proof?: string | null;
  experience_certificate?: string | null;
}

export interface UpdateDietitianData {
  state?: string;
  city?: string;
  experience?: string;
  specialization?: string[];
  degrees?: DegreeEntry[] | null;
  date_of_birth?: string | null;
  gender?: string | null;
  bio?: string | null;
  languages?: string[] | null;
  services?: string[] | null;
  awards?: AwardEntry[] | null;
  availability?: Record<string, string[]> | null;
  profile_photo?: string | null;
  degree_certificate?: string | null;
  registration_certificate?: string | null;
  id_proof?: string | null;
  experience_certificate?: string | null;
}

export interface DietitianWithUser extends Dietitian {
  full_name: string;
  email: string | null;
  phone_code: string | null;
  phone_number: string | null;
  is_active: boolean;
  avatar_url: string | null;
}

const toJson = (val: unknown) => (val != null ? JSON.stringify(val) : null);

export const parseJson = <T>(val: T | string | null): T | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return val as T;
};

export const formatDietitianRow = (d: DietitianWithUser) => ({
  id: d.id,
  user_id: d.user_id,
  full_name: d.full_name,
  email: d.email,
  phone_code: d.phone_code,
  phone_number: d.phone_number,
  avatar_url: d.avatar_url,
  is_active: d.is_active,
  date_of_birth: d.date_of_birth ?? null,
  gender: d.gender ?? null,
  bio: d.bio ?? null,
  state: d.state,
  city: d.city,
  registration_number: d.registration_number,
  experience: d.experience,
  specialization: parseJson<string[]>(d.specialization) ?? [],
  languages: parseJson<string[]>(d.languages) ?? [],
  services: parseJson<string[]>(d.services) ?? [],
  degrees: parseJson<DegreeEntry[]>(d.degrees) ?? [],
  awards: parseJson<AwardEntry[]>(d.awards) ?? [],
  availability: parseJson<Record<string, string[]>>(d.availability) ?? null,
  is_verified: d.is_verified,
  is_online: d.is_online,
  documents: {
    profile_photo: d.profile_photo,
    degree_certificate: d.degree_certificate,
    registration_certificate: d.registration_certificate,
    id_proof: d.id_proof,
    experience_certificate: d.experience_certificate,
  },
  created_at: d.created_at,
  updated_at: d.updated_at,
});

// Card-shaped row for the public /dietitians grid.
// rating / reviews / next_available have no backing data yet (no reviews or
// scheduling tables), so they are returned as safe placeholders.
export const formatDietitianCard = (d: DietitianWithUser, days = 14) => {
  const specialization = parseJson<string[]>(d.specialization) ?? [];
  const languages = parseJson<string[]>(d.languages) ?? [];
  const schedule = parseJson<Record<string, string[]>>(d.availability);
  const availableDates = buildAvailableDates(schedule, days);
  return {
    id: d.id,
    full_name: d.full_name,
    title: specialization[0] ?? 'Dietitian / Nutritionist',
    avatar_url: d.avatar_url ?? d.profile_photo ?? null,
    rating: 0,
    reviews: 0,
    experience: d.experience,
    location: [d.city, d.state].filter(Boolean).join(', '),
    specialization,
    languages,
    next_available: firstAvailable(availableDates),
    available_dates: availableDates,
    availability: d.is_online ? 'online' : 'offline',
    is_verified: d.is_verified,
  };
};

// Public profile shape — full details WITHOUT sensitive fields (email, phone,
// id proofs / certificates, registration number).
export const formatDietitianPublic = (
  d: DietitianWithUser,
  days = 30,
  bookedSlots: { appointment_date: string; slot: string }[] = [],
) => {
  const specialization = parseJson<string[]>(d.specialization) ?? [];
  const schedule = parseJson<Record<string, string[]>>(d.availability);
  const availableDates = buildAvailableDates(schedule, days);

  const bookedMap = new Map<string, Set<string>>();
  for (const b of bookedSlots) {
    if (!bookedMap.has(b.appointment_date)) bookedMap.set(b.appointment_date, new Set());
    bookedMap.get(b.appointment_date)!.add(b.slot);
  }

  const availableDatesWithBooked = availableDates.map((entry) => ({
    ...entry,
    booked_slots: [...(bookedMap.get(entry.date) ?? [])],
  }));

  return {
    id: d.id,
    full_name: d.full_name,
    title: specialization[0] ?? 'Dietitian / Nutritionist',
    avatar_url: d.avatar_url ?? d.profile_photo ?? null,
    gender: d.gender ?? null,
    about: d.bio ?? null,
    location: [d.city, d.state].filter(Boolean).join(', '),
    city: d.city,
    state: d.state,
    experience: d.experience,
    specialization,
    languages: parseJson<string[]>(d.languages) ?? [],
    services: parseJson<string[]>(d.services) ?? [],
    education: parseJson<DegreeEntry[]>(d.degrees) ?? [],
    awards: parseJson<AwardEntry[]>(d.awards) ?? [],
    slots: schedule ?? null,
    available_dates: availableDatesWithBooked,
    next_available: firstAvailable(availableDates),
    availability: d.is_online ? 'online' : 'offline',
    is_verified: d.is_verified,
    is_online: d.is_online,
    rating: 0,
    reviews: 0,
    reviewsList: [] as unknown[],
    fee: null as number | null,
    consultations: 0,
    created_at: d.created_at,
  };
};

const DIETITIAN_USER_SELECT = `
  SELECT
    d.id, d.user_id, d.state, d.city, d.registration_number,
    d.experience, d.specialization, d.date_of_birth, d.gender, d.bio,
    d.languages, d.services, d.degrees, d.awards, d.availability,
    d.profile_photo, d.degree_certificate, d.registration_certificate,
    d.id_proof, d.experience_certificate, d.is_verified, d.is_online, d.created_at, d.updated_at,
    u.full_name, u.email, u.phone_code, u.phone_number, u.is_active, u.avatar_url
  FROM dietitians d
  JOIN users u ON d.user_id = u.id
  WHERE u.is_delete = 0
`;

export const findDietitianByUserId = async (user_id: number) => {
  const rows = await query<Dietitian>('SELECT * FROM dietitians WHERE user_id = ? LIMIT 1', [user_id]);
  return rows[0] ?? null;
};

export const findDietitianByRegistrationNumber = async (registration_number: string) => {
  const rows = await query<Dietitian>('SELECT * FROM dietitians WHERE registration_number = ? LIMIT 1', [registration_number]);
  return rows[0] ?? null;
};

export const getAllDietitians = async (page: number, limit: number, is_verified: 0 | 1) => {
  const offset = (page - 1) * limit;
  const rows = await query<DietitianWithUser>(
    `${DIETITIAN_USER_SELECT} AND d.is_verified = ${is_verified} ORDER BY d.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
  );
  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM dietitians d JOIN users u ON d.user_id = u.id WHERE u.is_delete = 0 AND d.is_verified = ${is_verified}`,
  );
  return { rows, total: countRows[0]?.total ?? 0 };
};

export const findDietitianById = async (id: number) => {
  const rows = await query<DietitianWithUser>(
    `${DIETITIAN_USER_SELECT} AND d.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
};

// Public lookup — only an approved (verified) and active dietitian by id
export const findPublicDietitianById = async (id: number) => {
  const rows = await query<DietitianWithUser>(
    `${DIETITIAN_USER_SELECT} AND d.id = ? AND d.is_verified = 1 AND u.is_active = 1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
};

export interface DietitianListFilters {
  search?: string;
  specialization?: string;
  gender?: string;
  location?: string;
  language?: string;
  minExperience?: number;
  maxExperience?: number;
  availableNow?: boolean;
  sort?: 'top_rated' | 'most_reviewed' | 'available_now' | 'experience';
  page: number;
  limit: number;
}

// Public listing of approved dietitians with server-side search / filters / sort / pagination
export const listPublicDietitians = async (filters: DietitianListFilters) => {
  const conditions: string[] = ['d.is_verified = 1', 'u.is_active = 1'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [];

  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      `(u.full_name LIKE ? OR d.city LIKE ? OR d.state LIKE ? OR JSON_SEARCH(d.specialization, 'one', ?) IS NOT NULL)`,
    );
    params.push(like, like, like, like);
  }
  if (filters.specialization) {
    conditions.push(`JSON_SEARCH(d.specialization, 'one', ?) IS NOT NULL`);
    params.push(filters.specialization);
  }
  if (filters.gender) {
    conditions.push(`LOWER(d.gender) = LOWER(?)`);
    params.push(filters.gender);
  }
  if (filters.location) {
    const like = `%${filters.location}%`;
    conditions.push(`(d.city LIKE ? OR d.state LIKE ?)`);
    params.push(like, like);
  }
  if (filters.language) {
    conditions.push(`JSON_SEARCH(d.languages, 'one', ?) IS NOT NULL`);
    params.push(filters.language);
  }
  if (filters.minExperience != null) {
    conditions.push(`CAST(d.experience AS UNSIGNED) >= ?`);
    params.push(filters.minExperience);
  }
  if (filters.maxExperience != null) {
    conditions.push(`CAST(d.experience AS UNSIGNED) <= ?`);
    params.push(filters.maxExperience);
  }
  if (filters.availableNow) {
    conditions.push(`d.is_online = 1`);
  }

  const where = conditions.join(' AND ');

  // No ratings/reviews system yet, so top_rated / most_reviewed fall back to
  // "online first, then most experienced".
  const orderBy = (() => {
    switch (filters.sort) {
      case 'available_now':
        return 'd.is_online DESC, d.created_at DESC';
      case 'experience':
        return 'CAST(d.experience AS UNSIGNED) DESC, d.created_at DESC';
      case 'top_rated':
      case 'most_reviewed':
        return 'd.is_online DESC, CAST(d.experience AS UNSIGNED) DESC, d.created_at DESC';
      default:
        return 'd.created_at DESC';
    }
  })();

  const offset = (filters.page - 1) * filters.limit;

  const rows = await query<DietitianWithUser>(
    `${DIETITIAN_USER_SELECT} AND ${where} ORDER BY ${orderBy} LIMIT ${filters.limit} OFFSET ${offset}`,
    params,
  );
  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM dietitians d JOIN users u ON d.user_id = u.id WHERE u.is_delete = 0 AND ${where}`,
    params,
  );
  return { rows, total: countRows[0]?.total ?? 0 };
};

// Distinct specializations across approved dietitians, with a count of how many offer each
export const getDistinctSpecializations = async () => {
  return query<{ name: string; count: number }>(
    `SELECT spec.value AS name, COUNT(*) AS count
       FROM dietitians d
       JOIN users u ON d.user_id = u.id
       JOIN JSON_TABLE(d.specialization, '$[*]' COLUMNS (value VARCHAR(200) PATH '$')) spec
      WHERE u.is_delete = 0 AND d.is_verified = 1 AND u.is_active = 1
        AND spec.value IS NOT NULL AND spec.value <> ''
      GROUP BY spec.value
      ORDER BY count DESC, name ASC`,
  );
};

export const verifyDietitian = async (id: number) => {
  await execute('UPDATE dietitians SET is_verified = 1 WHERE id = ?', [id]);
};

export const createDietitian = async (data: CreateDietitianData) => {
  const result = await execute(
    `INSERT INTO dietitians
      (user_id, state, city, registration_number, experience, specialization,
       degrees, date_of_birth, gender, bio, languages, services, awards, availability,
       profile_photo, degree_certificate, registration_certificate, id_proof, experience_certificate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.state,
      data.city,
      data.registration_number,
      data.experience,
      toJson(data.specialization),
      toJson(data.degrees ?? null),
      data.date_of_birth ?? null,
      data.gender ?? null,
      data.bio ?? null,
      toJson(data.languages),
      toJson(data.services),
      toJson(data.awards),
      toJson(data.availability),
      data.profile_photo ?? null,
      data.degree_certificate ?? null,
      data.registration_certificate ?? null,
      data.id_proof ?? null,
      data.experience_certificate ?? null,
    ],
  );
  const rows = await query<Dietitian>('SELECT * FROM dietitians WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] ?? null;
};

export const updateDietitian = async (id: number, data: UpdateDietitianData) => {
  const jsonFields = new Set(['specialization', 'degrees', 'languages', 'services', 'awards', 'availability']);
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ');
  const values = [
    ...Object.entries(data).map(([k, v]) => jsonFields.has(k) ? toJson(v) : v),
    id,
  ];
  await execute(`UPDATE dietitians SET ${fields} WHERE id = ?`, values);
  return findDietitianById(id);
};
