/**
 * One-time fix script:
 * 1. Marks migration 110 as applied (column already exists in DB)
 * 2. Updates course_fee to 14999 in app_settings
 * 3. Then runs pending migration 111 (which also updates course_fee, so this is idempotent)
 *
 * Run with: npx ts-node src/scripts/fix_migration_110_and_course_fee.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { env } from '../config/env';

async function main() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  // Mark 110 as applied (ignore if already there)
  await conn.execute(
    `INSERT IGNORE INTO _migrations (name) VALUES (?)`,
    ['110_add_sort_order_to_dietitians'],
  );
  console.log('✅  Marked 110_add_sort_order_to_dietitians as applied');

  // Update course fee
  await conn.execute(`UPDATE app_settings SET value = '14999' WHERE \`key\` = 'course_fee'`);
  console.log('✅  Updated course_fee to 14999');

  // Mark 111 as applied too
  await conn.execute(
    `INSERT IGNORE INTO _migrations (name) VALUES (?)`,
    ['111_update_course_fee_to_14999'],
  );
  console.log('✅  Marked 111_update_course_fee_to_14999 as applied');

  await conn.end();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
