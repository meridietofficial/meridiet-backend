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
const [[user]] = await conn.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
const [[d]] = await conn.execute(
  'SELECT id, earnings_balance FROM dietitians WHERE user_id = ? LIMIT 1', [user.id]
);

console.log('\n════════════════════════════════════════');
console.log('  WALLET VERIFICATION — Prashansa dutt');
console.log('════════════════════════════════════════');

// 1. Available Balance
console.log(`\n[1] Available Balance : ₹${d.earnings_balance}  (UI shows ₹5,354)`);

// 2. Withdrawals
const [wds] = await conn.execute(
  `SELECT id, amount, status FROM dietitian_withdrawals WHERE dietitian_id = ? ORDER BY id`,
  [d.id]
);
const totalProcessed  = wds.filter(w => w.status === 'processed').reduce((s, w) => s + Number(w.amount), 0);
const totalProcessing = wds.filter(w => w.status === 'processing').reduce((s, w) => s + Number(w.amount), 0);
console.log(`\n[2] Withdrawals:`);
for (const w of wds) console.log(`    #${w.id} | ₹${w.amount} | ${w.status}`);
console.log(`    → Processed (counted in Total Withdrawn): ₹${totalProcessed}`);
console.log(`    → Still processing (not yet counted): ₹${totalProcessing}`);
console.log(`    UI shows "Total Withdrawn: ₹8" — expected ₹${totalProcessed} (only processed ones count)`);

// 3. Earnings wallet transactions (source of truth for month summary)
const now = new Date();
const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01 00:00:00`;
const [txsMonth] = await conn.execute(
  `SELECT type, source, gross_amount, commission, net_amount, balance_after, description, created_at
   FROM dietitian_wallet_transactions
   WHERE dietitian_id = ? AND wallet = 'earnings' AND created_at >= ?
   ORDER BY created_at`,
  [d.id, monthStart]
);
console.log(`\n[3] Earnings transactions this month (Sep 2026):`);
if (!txsMonth.length) console.log('    None');
let grossMonth = 0, commissionMonth = 0, netMonth = 0;
for (const tx of txsMonth) {
  console.log(`    ${tx.type.toUpperCase()} | gross: ₹${tx.gross_amount} | commission: ₹${tx.commission} | net: ₹${tx.net_amount} | ${tx.source} | ${tx.description}`);
  if (tx.type === 'credit' && tx.source === 'appointment_completion') {
    grossMonth      += Number(tx.gross_amount);
    commissionMonth += Number(tx.commission);
    netMonth        += Number(tx.net_amount);
  }
}
console.log(`    → Gross (appointment credits): ₹${grossMonth}  (UI shows ₹200)`);
console.log(`    → Commission deducted:         ₹${commissionMonth}`);
console.log(`    → Net earned:                  ₹${netMonth}  (UI shows ₹150)`);

// 4. All earnings wallet transactions (all time)
const [txsAll] = await conn.execute(
  `SELECT type, source, gross_amount, commission, net_amount, description, created_at
   FROM dietitian_wallet_transactions
   WHERE dietitian_id = ? AND wallet = 'earnings'
   ORDER BY created_at`,
  [d.id]
);
console.log(`\n[4] All earnings wallet transactions:`);
if (!txsAll.length) console.log('    None');
for (const tx of txsAll) console.log(`    ${tx.type.toUpperCase()} | ₹${tx.net_amount} | ${tx.source} | ${tx.description} | ${new Date(tx.created_at).toLocaleDateString('en-IN')}`);

// 5. Platform fee setting
const [settings] = await conn.execute(
  `SELECT \`key\`, value FROM app_settings WHERE \`key\` LIKE '%commission%' OR \`key\` LIKE '%fee%'`
);
console.log('\n[5] Platform fee from app_settings:');
if (!settings.length) console.log('    Not found');
for (const s of settings) console.log(`    ${s.key} = ${s.value}`);

// 6. Pending payout (completed appointments not yet approved/credited)
const [pendingAppts] = await conn.execute(
  `SELECT id, fee, final_amount, status, payment_status, appointment_date
   FROM appointments
   WHERE dietitian_id = ? AND status = 'completed' AND payment_status != 'approved'
   ORDER BY appointment_date DESC`,
  [d.id]
);
console.log(`\n[6] Appointments completed but payment not approved (pending payout source):`);
if (!pendingAppts.length) console.log('    None — pending payout ₹0 is correct');
for (const a of pendingAppts) console.log(`    #${a.id} | ₹${a.final_amount ?? a.fee} | ${a.status} | payment: ${a.payment_status} | ${a.appointment_date}`);

console.log('\n════════════════════════════════════════\n');
await conn.end();
