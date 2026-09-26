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

const [[user]] = await conn.execute(
  'SELECT id FROM users WHERE email = ? LIMIT 1',
  ['prashansadutt@yopmail.com']
);
const [[d]] = await conn.execute(
  'SELECT id, earnings_balance FROM dietitians WHERE user_id = ? LIMIT 1',
  [user.id]
);

console.log('\n════════════════════════════════════════════════');
console.log('  EARNINGS BALANCE AUDIT — Prashansa Dutt (#' + d.id + ')');
console.log('════════════════════════════════════════════════');
console.log('DB earnings_balance: ₹' + d.earnings_balance);

// All earnings wallet transactions
const [txs] = await conn.execute(
  `SELECT id, type, source, gross_amount, commission, net_amount, balance_after, description, created_at
   FROM dietitian_wallet_transactions
   WHERE dietitian_id = ? AND wallet = 'earnings'
   ORDER BY id ASC`,
  [d.id]
);

console.log('\nAll earnings wallet transactions (' + txs.length + '):');
if (txs.length === 0) {
  console.log('  *** NONE FOUND ***');
} else {
  txs.forEach(t => {
    const sign = t.type === 'credit' ? '+' : '-';
    console.log(
      '  #' + t.id +
      ' | ' + t.type.toUpperCase() +
      ' | src=' + t.source +
      ' | net=' + sign + '₹' + t.net_amount +
      ' | bal_after=₹' + t.balance_after +
      ' | ' + String(t.description).substring(0, 60) +
      '\n    → ' + t.created_at
    );
  });
}

// Running sum
let runningSum = 0;
for (const t of txs) {
  runningSum += t.type === 'credit' ? Number(t.net_amount) : -Number(t.net_amount);
}
const dbBal = Number(d.earnings_balance);
const unexplained = dbBal - runningSum;

console.log('\n── Balance Reconciliation ──────────────────────');
console.log('Running sum of all earnings txs : ₹' + runningSum.toFixed(2));
console.log('DB earnings_balance             : ₹' + dbBal.toFixed(2));
if (Math.abs(unexplained) < 0.01) {
  console.log('✅ BALANCED — no discrepancy');
} else {
  console.log('❌ MISMATCH — unexplained amount: ₹' + unexplained.toFixed(2));
  console.log('   The ₹' + unexplained.toFixed(2) + ' has no audit trail in wallet transactions.');
}

// All plan wallet transactions for context
const [planTxs] = await conn.execute(
  `SELECT id, type, source, net_amount, balance_after, description, created_at
   FROM dietitian_wallet_transactions
   WHERE dietitian_id = ? AND wallet = 'plan'
   ORDER BY id ASC`,
  [d.id]
);
console.log('\nPlan wallet transactions (' + planTxs.length + ') — for context:');
planTxs.forEach(t => {
  const sign = t.type === 'credit' ? '+' : '-';
  console.log(
    '  #' + t.id +
    ' | ' + t.type.toUpperCase() +
    ' | src=' + t.source +
    ' | net=' + sign + '₹' + t.net_amount +
    ' | bal_after=₹' + t.balance_after +
    ' | ' + String(t.description).substring(0, 55)
  );
});

// Check approved appointments
const [appts] = await conn.execute(
  `SELECT id, payment_status, fee, session_type, created_at
   FROM appointments
   WHERE dietitian_id = ? AND payment_status = 'approved'
   LIMIT 20`,
  [d.id]
);
console.log('\nApproved appointments (' + appts.length + '):');
if (appts.length === 0) {
  console.log('  *** NONE — admin has never approved any appointment payment ***');
} else {
  appts.forEach(a => console.log('  #' + a.id + ' | fee=₹' + a.fee + ' | ' + a.session_type + ' | ' + a.created_at));
}

// Check admin credit history in audit log if exists
const [[auditExists]] = await conn.execute(
  `SELECT COUNT(*) as c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'admin_audit_log'`
);
if (auditExists.c > 0) {
  const [auditRows] = await conn.execute(
    `SELECT * FROM admin_audit_log WHERE target_id = ? ORDER BY created_at DESC LIMIT 10`,
    [d.id]
  );
  console.log('\nAdmin audit log entries: ' + auditRows.length);
  auditRows.forEach(r => console.log('  ' + JSON.stringify(r)));
}

await conn.end();
console.log('\nDone.\n');
