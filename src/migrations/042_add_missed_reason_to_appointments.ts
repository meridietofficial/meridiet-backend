export const up = `
  ALTER TABLE appointments
    ADD COLUMN missed_reason TEXT DEFAULT NULL AFTER dietitian_notes;
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN missed_reason;
`;
