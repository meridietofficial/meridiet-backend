export const up = `
  ALTER TABLE dietitians
    ADD COLUMN appointment_fee      DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER is_online,
    ADD COLUMN appointment_currency VARCHAR(10)   NOT NULL DEFAULT 'INR' AFTER appointment_fee;
`;

export const down = `
  ALTER TABLE dietitians
    DROP COLUMN appointment_currency,
    DROP COLUMN appointment_fee;
`;
