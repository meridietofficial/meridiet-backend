export const up = `
  ALTER TABLE appointments
    ADD COLUMN reminder_1h_sent_at              DATETIME NULL DEFAULT NULL,
    ADD COLUMN reminder_10min_sent_at           DATETIME NULL DEFAULT NULL,
    ADD COLUMN reminder_dietitian_15min_sent_at DATETIME NULL DEFAULT NULL
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN reminder_1h_sent_at,
    DROP COLUMN reminder_10min_sent_at,
    DROP COLUMN reminder_dietitian_15min_sent_at
`;
