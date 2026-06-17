export const up = `
  ALTER TABLE appointments
    ADD COLUMN dietitian_notes TEXT DEFAULT NULL AFTER notes;
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN dietitian_notes;
`;
