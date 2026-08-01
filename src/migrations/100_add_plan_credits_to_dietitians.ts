export const up = `
  ALTER TABLE dietitians
    ADD COLUMN plan_credits DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER earnings_balance;
`;

export const down = `
  ALTER TABLE dietitians DROP COLUMN plan_credits;
`;
