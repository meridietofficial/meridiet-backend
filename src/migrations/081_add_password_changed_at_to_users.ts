export const up = `
  ALTER TABLE users
  ADD COLUMN password_changed_at DATETIME NULL DEFAULT NULL;
`;

export const down = `
  ALTER TABLE users
  DROP COLUMN password_changed_at;
`;
