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

const DIETITIAN_ID = 37;
const TEST_IDS     = [1, 2, 3];   // stuck processing test withdrawals
const REFUND_AMT   = 6.00;         // 3 × ₹2

await conn.beginTransaction();
try {
  // 1. Refund ₹6 to the dietitian's earnings balance
  await conn.execute(
    'UPDATE dietitians SET earnings_balance = earnings_balance + ? WHERE id = ?',
    [REFUND_AMT, DIETITIAN_ID],
  );

  // 2. Delete the debit wallet transactions for these withdrawals
  const placeholders = TEST_IDS.map(() => '?').join(',');
  const refIds = TEST_IDS.map(id => `wd_${id}`);
  await conn.execute(
    `DELETE FROM dietitian_wallet_transactions
     WHERE dietitian_id = ?
       AND source = 'withdrawal'
       AND reference_id IN (${placeholders})`,
    [DIETITIAN_ID, ...refIds],
  );

  // 3. Delete the withdrawal records
  await conn.execute(
    `DELETE FROM dietitian_withdrawals WHERE id IN (${placeholders}) AND dietitian_id = ?`,
    [...TEST_IDS, DIETITIAN_ID],
  );

  await conn.commit();
  console.log('✓ Refunded ₹6 to earnings balance');
  console.log('✓ Deleted wallet transactions: wd_1, wd_2, wd_3');
  console.log('✓ Deleted withdrawal records #1, #2, #3');

  // 4. Verify final state
  const [[d]] = await conn.execute(
    'SELECT earnings_balance FROM dietitians WHERE id = ? LIMIT 1', [DIETITIAN_ID],
  );
  console.log(`\nNew earnings_balance: ₹${Number(d.earnings_balance).toFixed(2)}`);

  const [wds] = await conn.execute(
    'SELECT id, amount, status FROM dietitian_withdrawals WHERE dietitian_id = ? ORDER BY id',
    [DIETITIAN_ID],
  );
  console.log('\nRemaining withdrawals:');
  if (!wds.length) console.log('  None');
  for (const w of wds) console.log(`  #${w.id} | ₹${w.amount} | ${w.status}`);

  const [txs] = await conn.execute(
    `SELECT type, net_amount, source, description FROM dietitian_wallet_transactions
     WHERE dietitian_id = ? ORDER BY created_at`,
    [DIETITIAN_ID],
  );
  console.log('\nRemaining wallet transactions:');
  if (!txs.length) console.log('  None');
  for (const t of txs) console.log(`  ${t.type.toUpperCase()} | ₹${t.net_amount} | ${t.source} | ${t.description}`);

} catch (err) {
  await conn.rollback();
  console.error('ERROR — rolled back:', err.message);
}

await conn.end();
