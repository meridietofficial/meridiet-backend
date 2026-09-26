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

// Find all withdrawals that are processing/processed but have no wallet transaction entry
const [withdrawals] = await conn.execute(`
  SELECT dw.id, dw.dietitian_id, dw.amount, dw.status, dw.requested_at,
         d.earnings_balance
  FROM dietitian_withdrawals dw
  JOIN dietitians d ON d.id = dw.dietitian_id
  WHERE dw.status IN ('processing', 'processed')
    AND NOT EXISTS (
      SELECT 1 FROM dietitian_wallet_transactions dwt
      WHERE dwt.reference_id = CONCAT('wd_', dw.id)
        AND dwt.dietitian_id = dw.dietitian_id
    )
`);

console.log(`Found ${withdrawals.length} withdrawal(s) missing transaction records`);

for (const w of withdrawals) {
  // Use earnings_balance as balance_after since we can't know the exact balance at time of withdrawal
  // For 'processing' withdrawals the balance is already deducted
  await conn.execute(
    `INSERT INTO dietitian_wallet_transactions
       (dietitian_id, type, wallet, source, gross_amount, commission, net_amount,
        balance_after, description, reference_id, created_at)
     VALUES (?, 'debit', 'earnings', 'withdrawal', ?, 0, ?, ?, ?, ?, ?)`,
    [
      w.dietitian_id,
      w.amount,
      w.amount,
      w.earnings_balance, // current balance (already deducted)
      `Withdrawal request — ₹${w.amount}`,
      `wd_${w.id}`,
      w.requested_at,
    ]
  );
  console.log(`  ✓ Backfilled withdrawal #${w.id} — ₹${w.amount} debit for dietitian ${w.dietitian_id}`);
}

console.log('Done.');
await conn.end();
