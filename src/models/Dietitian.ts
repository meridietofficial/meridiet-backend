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
