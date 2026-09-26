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

const email = 'prashansadutt@yopmail.com';

const [[user]] = await conn.execute(
  'SELECT id, full_name, email FROM users WHERE email = ? LIMIT 1', [email]
);
if (!user) { console.log('User not found'); process.exit(1); }
console.log('\n── USER ─────────────────────────────');
console.log(`  ID: ${user.id} | Name: ${user.full_name} | Email: ${user.email}`);

const [[d]] = await conn.execute(
  'SELECT id, earnings_balance FROM dietitians WHERE user_id = ? LIMIT 1', [user.id]
);
console.log('\n── DIETITIAN ────────────────────────');
console.log(`  Dietitian ID : ${d.id}`);
console.log(`  Earnings Bal : ₹${d.earnings_balance}`);

const [withdrawals] = await conn.execute(
  `SELECT id, amount, status, cashfree_transfer_id, utr, failure_reason,
          requested_at, processed_at
   FROM dietitian_withdrawals WHERE dietitian_id = ?
   ORDER BY requested_at DESC LIMIT 5`,
  [d.id]
);
console.log('\n── WITHDRAWALS (latest 5) ───────────');
if (!withdrawals.length) { console.log('  None found'); }
for (const w of withdrawals) {
  console.log(`  #${w.id} | ₹${w.amount} | status: ${w.status} | cashfree_id: ${w.cashfree_transfer_id ?? '—'} | UTR: ${w.utr ?? '—'} | reason: ${w.failure_reason ?? '—'} | at: ${w.requested_at}`);
}

const [accounts] = await conn.execute(
  `SELECT id, type, upi_id, bank_name, account_number, ifsc_code, account_holder, is_primary
   FROM dietitian_payment_accounts WHERE dietitian_id = ?`,
  [d.id]
);
console.log('\n── LINKED ACCOUNTS ──────────────────');
if (!accounts.length) { console.log('  None found'); }
for (const a of accounts) {
  const detail = a.type === 'upi' ? `UPI: ${a.upi_id}` : `${a.bank_name} | ${a.account_holder} | ****${String(a.account_number ?? '').slice(-4)} | ${a.ifsc_code}`;
  console.log(`  #${a.id} | ${a.type.toUpperCase()} | ${detail} | primary: ${a.is_primary ? 'YES' : 'no'}`);
}

console.log('');
await conn.end();
