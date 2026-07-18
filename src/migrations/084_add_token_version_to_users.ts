export const up = `
  ALTER TABLE users
  ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0;
`;

export const down = `
  ALTER TABLE users
  DROP COLUMN token_version;
`;
