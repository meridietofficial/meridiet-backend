export const up = `
  ALTER TABLE users
    ADD COLUMN google_id VARCHAR(255) DEFAULT NULL UNIQUE AFTER email;
`;

export const down = `
  ALTER TABLE users DROP COLUMN google_id;
`;
