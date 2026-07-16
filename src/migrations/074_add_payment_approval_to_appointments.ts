export const up = `
  ALTER TABLE appointments
    ADD COLUMN payment_approved_at   DATETIME  NULL AFTER payment_status,
    ADD COLUMN payment_approved_by   INT       NULL AFTER payment_approved_at;
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN payment_approved_by,
    DROP COLUMN payment_approved_at;
`;
