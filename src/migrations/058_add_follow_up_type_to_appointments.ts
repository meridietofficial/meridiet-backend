export const up = `
  ALTER TABLE appointments
    ADD COLUMN follow_up_type VARCHAR(100) DEFAULT NULL AFTER is_follow_up;
`;

export const down = `
  ALTER TABLE appointments DROP COLUMN follow_up_type;
`;
