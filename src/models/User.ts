import bcrypt from 'bcryptjs';
import { query, execute } from '../config/database';

export interface User {
  id: number;
  full_name: string;
  email: string | null;
  google_id: string | null;
  password: string;
  phone_code: string | null;
  phone_number: string | null;
  role: 'user' | 'admin' | 'dietitian';
  is_active: boolean;
  is_delete: boolean;
  avatar_url: string | null;
  wallet_balance: number;
  reset_token_hash: string | null;
  reset_token_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  full_name: string;
  email?: string | null;
  password: string;
  phone_code?: string | null;
  phone_number?: string | null;
  role?: 'user' | 'admin' | 'dietitian';
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
  return query<User>('SELECT id, full_name, email, phone_code, phone_number, role, is_active, avatar_url, wallet_balance, created_at, updated_at FROM users WHERE is_delete = 0');
};

const USER_SELECT = 'SELECT id, full_name, email, phone_code, phone_number, role, is_active, avatar_url, wallet_balance, created_at, updated_at FROM users';

export const getUsersPaginated = async (page: number, limit: number) => {
  const offset = (page - 1) * limit;
  const rows = await query<Omit<User, 'password' | 'is_delete'>>(
    `${USER_SELECT} WHERE role = 'user' AND is_delete = 0 ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
  );
  const countRows = await query<{ total: number }>("SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND is_delete = 0");
  return { rows, total: countRows[0]?.total ?? 0 };
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
  await execute('UPDATE users SET is_delete = 1, is_active = 0 WHERE id = ?', [id]);
};

export const updateUserPassword = async (id: number, newPassword: string) => {
  const hashed = await bcrypt.hash(newPassword, 12);
  await execute('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
};

// Store a hashed password-reset token + its expiry against a user.
export const setPasswordResetToken = async (id: number, tokenHash: string, expiresAt: Date) => {
  await execute('UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?', [
    tokenHash,
    expiresAt,
    id,
  ]);
};

// Find a (non-deleted) user by a still-valid reset token hash.
export const findUserByResetTokenHash = async (tokenHash: string) => {
  const rows = await query<User>(
    'SELECT * FROM users WHERE reset_token_hash = ? AND reset_token_expires_at > NOW() AND is_delete = 0 LIMIT 1',
    [tokenHash],
  );
  return rows[0] ?? null;
};

// Set a new password and clear the reset token in one shot.
export const resetUserPassword = async (id: number, newPassword: string) => {
  const hashed = await bcrypt.hash(newPassword, 12);
  await execute(
    'UPDATE users SET password = ?, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?',
    [hashed, id],
  );
};

export const checkPassword = async (plainText: string, hashed: string) => {
  return bcrypt.compare(plainText, hashed);
};

export const findUserByGoogleId = async (googleId: string) => {
  const rows = await query<User>('SELECT * FROM users WHERE google_id = ? AND is_delete = 0 LIMIT 1', [googleId]);
  return rows[0] ?? null;
};

export const findDeletedUserByGoogleId = async (googleId: string) => {
  const rows = await query<User>('SELECT * FROM users WHERE google_id = ? AND is_delete = 1 LIMIT 1', [googleId]);
  return rows[0] ?? null;
};

export const restoreDeletedUser = async (id: number) => {
  await execute('UPDATE users SET is_delete = 0, is_active = 1 WHERE id = ?', [id]);
  return findUserById(id);
};

// Case 2: email exists, bind google_id to that account
export const linkGoogleId = async (userId: number, googleId: string, avatarUrl: string | null) => {
  await execute(
    'UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?',
    [googleId, avatarUrl, userId],
  );
  return findUserById(userId);
};

// Case 3: new user — register via Google
export const createGoogleUser = async (data: {
  google_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role: 'user' | 'dietitian';
}) => {
  const placeholder = await bcrypt.hash(data.google_id + Date.now(), 12);
  const result = await execute(
    'INSERT INTO users (full_name, email, google_id, password, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)',
    [data.full_name, data.email, data.google_id, placeholder, data.avatar_url ?? null, data.role],
  );
  return findUserById(result.insertId);
};
