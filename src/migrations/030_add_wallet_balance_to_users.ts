export const up = `
  ALTER TABLE users
  ADD COLUMN wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00;
`;

export const down = `
  ALTER TABLE users DROP COLUMN wallet_balance;
`;
