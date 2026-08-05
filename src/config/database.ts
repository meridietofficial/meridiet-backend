import mysql from 'mysql2/promise';
import { env } from './env';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00', // DB stores UTC via CURRENT_TIMESTAMP; tell mysql2 to read DATETIME columns as UTC so toIST() gives correct IST dates
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export const connectDatabase = async () => {
  const conn = await pool.getConnection();
  conn.release();
  console.log(`✅ MySQL connected successfully!`);
};

export const disconnectDatabase = async () => {
  await pool.end();
  console.log('MySQL pool closed');
};

// Run a SELECT query — returns an array of rows
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

// Run INSERT / UPDATE / DELETE — returns result info (insertId, affectedRows)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function execute(sql: string, params?: any[]) {
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

// Run multiple operations inside a single DB transaction.
// Rolls back automatically on any error.
export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
