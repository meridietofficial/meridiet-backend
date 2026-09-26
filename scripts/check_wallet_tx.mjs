import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await mysql.createConnection({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Get dietitian id for this user
const [[user]] = await conn.execute(
  'SELECT id FROM users WHERE email = ? LIMIT 1', ['prashansadutt@yopmail.com']
);
const [[d]] = await conn.execute(
  'SELECT id FROM dietitians WHERE user_id = ? LIMIT 1', [user.id]
);

console.log(`\nDietitian ID: ${d.id}`);

// Check wallet transactions table name
const [tables] = await conn.execute(
  `SELECT TABLE_NAME FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%wallet%' OR TABLE_NAME LIKE '%transaction%' OR TABLE_NAME LIKE '%earning%'`,
  [process.env.DB_NAME]
);
console.log('\n── WALLET/TX TABLES ─────────────────');
for (const t of tables) console.log(' ', t.TABLE_NAME);

// Try fetching from dietitian_wallet_transactions
try {
  const [txs] = await conn.execute(
    `SELECT * FROM dietitian_wallet_transactions
     WHERE dietitian_id = ? ORDER BY created_at DESC LIMIT 10`,
    [d.id]
  );
  console.log(`\n── dietitian_wallet_transactions (${txs.length} rows) ──`);
  for (const tx of txs) console.log(JSON.stringify(tx));
} catch (e) { console.log('dietitian_wallet_transactions: table not found'); }

// Try fetching from earnings_transactions
try {
  const [txs] = await conn.execute(
    `SELECT * FROM earnings_transactions
     WHERE dietitian_id = ? ORDER BY created_at DESC LIMIT 10`,
    [d.id]
  );
  console.log(`\n── earnings_transactions (${txs.length} rows) ──`);
  for (const tx of txs) console.log(JSON.stringify(tx));
} catch (e) { console.log('earnings_transactions: table not found'); }

await conn.end();
