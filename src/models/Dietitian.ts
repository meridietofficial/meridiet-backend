import { query, execute } from '../config/database';

export interface Dietitian {
  id: number;
  user_id: number;
  state: string;
  city: string;
  highest_degree: string;
  registration_number: string;
  experience: string;
  specialization: string;
  profile_photo: string | null;
  degree_certificate: string | null;
  registration_certificate: string | null;
  id_proof: string | null;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDietitianData {
  user_id: number;
  state: string;
  city: string;
  highest_degree: string;
  registration_number: string;
  experience: string;
  specialization: string;
  profile_photo?: string | null;
  degree_certificate?: string | null;
  registration_certificate?: string | null;
  id_proof?: string | null;
}

export const findDietitianByUserId = async (user_id: number) => {
  const rows = await query<Dietitian>('SELECT * FROM dietitians WHERE user_id = ? LIMIT 1', [user_id]);
  return rows[0] ?? null;
};

export const findDietitianByRegistrationNumber = async (registration_number: string) => {
  const rows = await query<Dietitian>('SELECT * FROM dietitians WHERE registration_number = ? LIMIT 1', [registration_number]);
  return rows[0] ?? null;
};

export interface DietitianWithUser extends Dietitian {
  full_name: string;
  email: string | null;
  phone_code: string | null;
  phone_number: string | null;
  is_active: boolean;
  avatar_url: string | null;
}

const DIETITIAN_USER_SELECT = `
  SELECT
    d.id, d.user_id, d.state, d.city, d.highest_degree, d.registration_number,
    d.experience, d.specialization, d.profile_photo, d.degree_certificate,
    d.registration_certificate, d.id_proof, d.is_verified, d.created_at, d.updated_at,
    u.full_name, u.email, u.phone_code, u.phone_number, u.is_active, u.avatar_url
  FROM dietitians d
  JOIN users u ON d.user_id = u.id
  WHERE u.is_delete = 0
`;

export const getAllDietitians = async (page: number, limit: number, is_verified: 0 | 1) => {
  const offset = (page - 1) * limit;
  // LIMIT/OFFSET can't be bound as prepared-statement params in mysql2 — embed as validated integers
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

export const verifyDietitian = async (id: number) => {
  await execute('UPDATE dietitians SET is_verified = 1 WHERE id = ?', [id]);
};

export const createDietitian = async (data: CreateDietitianData) => {
  const result = await execute(
    `INSERT INTO dietitians
      (user_id, state, city, highest_degree, registration_number, experience, specialization,
       profile_photo, degree_certificate, registration_certificate, id_proof)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.state,
      data.city,
      data.highest_degree,
      data.registration_number,
      data.experience,
      data.specialization,
      data.profile_photo ?? null,
      data.degree_certificate ?? null,
      data.registration_certificate ?? null,
      data.id_proof ?? null,
    ],
  );
  const rows = await query<Dietitian>('SELECT * FROM dietitians WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] ?? null;
};
