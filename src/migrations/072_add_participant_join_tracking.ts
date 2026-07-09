export const up = `
  ALTER TABLE appointments
    ADD COLUMN user_joined_at      DATETIME NULL DEFAULT NULL,
    ADD COLUMN dietitian_joined_at DATETIME NULL DEFAULT NULL
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN user_joined_at,
    DROP COLUMN dietitian_joined_at
`;
