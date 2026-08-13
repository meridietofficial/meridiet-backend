export const up = `
  ALTER TABLE diet_forms
    ADD COLUMN submitted_at        DATETIME NULL DEFAULT NULL,
    ADD COLUMN reminder_1_sent_at  DATETIME NULL DEFAULT NULL,
    ADD COLUMN reminder_2_sent_at  DATETIME NULL DEFAULT NULL,
    ADD COLUMN reminder_3_sent_at  DATETIME NULL DEFAULT NULL;
`;

export const down = `
  ALTER TABLE diet_forms
    DROP COLUMN submitted_at,
    DROP COLUMN reminder_1_sent_at,
    DROP COLUMN reminder_2_sent_at,
    DROP COLUMN reminder_3_sent_at;
`;
