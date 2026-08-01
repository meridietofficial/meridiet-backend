import 'dotenv/config';
import { connectDatabase } from '../config/database';
import { query, execute } from '../config/database';

const PHONE  = '9823355995';
const AMOUNT = 500;

const run = async () => {
  await connectDatabase();

  const users = await query<{ id: number; name: string; email: string; wallet_balance: string }>(
    'SELECT id, full_name AS name, email, wallet_balance FROM users WHERE phone_number = ? LIMIT 1',
    [PHONE],
  );

  if (users.length === 0) {
    console.error('User not found:', PHONE);
    process.exit(1);
  }

  const user = users[0];
  const currentBalance = Number(user.wallet_balance);
  const newBalance = currentBalance + AMOUNT;

  console.log(`User   : ${user.name} (id=${user.id})`);
  console.log(`Balance: ₹${currentBalance} → ₹${newBalance}`);

  await execute(
    'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
    [AMOUNT, user.id],
  );

  await execute(
    `INSERT INTO wallet_transactions (user_id, type, source, amount, balance_after, description, reference_id)
     VALUES (?, 'credit', 'admin_credit', ?, ?, 'Admin credit — ₹${AMOUNT}', ?)`,
    [user.id, AMOUNT, newBalance, `admin_credit_${Date.now()}`],
  );

  console.log(`✅ ₹${AMOUNT} credited successfully. New balance: ₹${newBalance}`);
  process.exit(0);
};

run().catch((err) => { console.error('Error:', err.message); process.exit(1); });
