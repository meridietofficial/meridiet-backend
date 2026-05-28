/**
 * Migration Runner
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs all pending migration files in order.
 *
 * Usage:  npm run migrate
 *         npm run migrate:rollback
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { env } from '../config/env';

interface Migration {
  name: string;
  up: string;
  down: string;
}

// ─── Load migration files ─────────────────────────────────────────────────────
function loadMigrations(): Migration[] {
  const migrationsDir = path.join(__dirname);
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.match(/^\d{3}_.*\.(ts|js)$/) && !f.includes('runner'))
    .sort(); // 001_, 002_, 003_...

  return files.map((file) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(path.join(migrationsDir, file)) as Migration;
    return { name: file.replace(/\.(ts|js)$/, ''), up: mod.up, down: mod.down };
  });
}

// ─── Runner ───────────────────────────────────────────────────────────────────
async function run(rollback = false) {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  // Create migrations tracking table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      run_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await conn.execute('SELECT name FROM _migrations');
  const ran = new Set((rows as { name: string }[]).map((r) => r.name));

  const migrations = loadMigrations();

  if (rollback) {
    // Rollback the last ran migration
    const last = [...ran].pop();
    const target = migrations.find((m) => m.name === last);
    if (!target) { console.log('Nothing to rollback.'); return conn.end(); }

    console.log(`⏪  Rolling back: ${target.name}`);
    await conn.execute(target.down);
    await conn.execute('DELETE FROM _migrations WHERE name = ?', [target.name]);
    console.log(`✅  Done`);
  } else {
    // Run pending migrations
    const pending = migrations.filter((m) => !ran.has(m.name));
    if (!pending.length) { console.log('✅  All migrations up to date.'); return conn.end(); }

    for (const m of pending) {
      console.log(`⚡  Running: ${m.name}`);
      await conn.execute(m.up);
      await conn.execute('INSERT INTO _migrations (name) VALUES (?)', [m.name]);
      console.log(`✅  Done: ${m.name}`);
    }
  }

  await conn.end();
}

const isRollback = process.argv.includes('--rollback');
run(isRollback).catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
