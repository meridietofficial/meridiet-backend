import bcrypt from 'bcryptjs';
import { query, execute } from '../config/database';

export interface User {
  id: number;
  full_name: string;
  email: string | null;
  password: string;
  phone_code: string | null;
  phone_number: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  is_delete: boolean;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  full_name: string;
  email?: string | null;
  password: string;
  phone_code?: string | null;
  phone_number?: string | null;
  role?: 'user' | 'admin';
}

export interface UpdateUserData {
  full_name?: string;
  email?: string | null;
  phone_code?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
}

export const findUserById = async (id: number) => {
  const rows = await query<User>('SELECT * FROM users WHERE id = ? AND is_delete = 0 LIMIT 1', [id]);
  return rows[0] ?? null;
};

export const findUserByEmail = async (email: string) => {
  const rows = await query<User>('SELECT * FROM users WHERE email = ? AND is_delete = 0 LIMIT 1', [email]);
  return rows[0] ?? null;
};

export const findUserByPhone = async (phone_code: string, phone_number: string) => {
  const rows = await query<User>('SELECT * FROM users WHERE phone_code = ? AND phone_number = ? AND is_delete = 0 LIMIT 1', [phone_code, phone_number]);
  return rows[0] ?? null;
};

export const findUserByPhoneNumber = async (phone_number: string) => {
  const rows = await query<User>('SELECT * FROM users WHERE phone_number = ? AND is_delete = 0 LIMIT 1', [phone_number]);
  return rows[0] ?? null;
};

export const getAllUsers = async () => {
  return query<User>('SELECT id, full_name, email, phone_code, phone_number, role, is_active, avatar_url, created_at, updated_at FROM users WHERE is_delete = 0');
};

export const createUser = async (data: CreateUserData) => {
  const hashedPassword = await bcrypt.hash(data.password, 12);
  const result = await execute(
    'INSERT INTO users (full_name, email, password, phone_code, phone_number, role) VALUES (?, ?, ?, ?, ?, ?)',
    [data.full_name, data.email ?? null, hashedPassword, data.phone_code ?? null, data.phone_number ?? null, data.role ?? 'user'],
  );
  return findUserById(result.insertId);
};

export const updateUser = async (id: number, data: UpdateUserData) => {
  const fields = Object.keys(data).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(data), id];
  await execute(`UPDATE users SET ${fields} WHERE id = ?`, values);
  return findUserById(id);
};

export const softDeleteUser = async (id: number) => {
  await execute('UPDATE users SET is_delete = 1 WHERE id = ?', [id]);
};

export const checkPassword = async (plainText: string, hashed: string) => {
  return bcrypt.compare(plainText, hashed);
};
