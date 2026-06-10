export const up = `
  ALTER TABLE payments
    ADD COLUMN months_total     INT            NOT NULL DEFAULT 1    AFTER amount,
    ADD COLUMN months_generated INT            NOT NULL DEFAULT 0    AFTER months_total,
    ADD COLUMN per_month_amount DECIMAL(10,2)  NOT NULL DEFAULT 0.00 AFTER months_generated;
`;

export const down = `
  ALTER TABLE payments
    DROP COLUMN per_month_amount,
    DROP COLUMN months_generated,
    DROP COLUMN months_total;
`;
