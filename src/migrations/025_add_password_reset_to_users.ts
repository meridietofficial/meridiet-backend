export const up = `
  ALTER TABLE users
    ADD COLUMN reset_token_hash VARCHAR(255) DEFAULT NULL,
    ADD COLUMN reset_token_expires_at DATETIME DEFAULT NULL;
`;

export const down = `
  ALTER TABLE users
    DROP COLUMN reset_token_hash,
    DROP COLUMN reset_token_expires_at;
`;
