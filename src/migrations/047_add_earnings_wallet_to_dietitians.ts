export const up = `
  ALTER TABLE dietitians
    ADD COLUMN earnings_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER appointment_currency;
`;

export const down = `
  ALTER TABLE dietitians
    DROP COLUMN earnings_balance;
`;
