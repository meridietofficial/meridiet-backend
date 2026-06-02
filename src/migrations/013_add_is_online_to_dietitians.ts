export const up = `
  ALTER TABLE dietitians ADD COLUMN is_online TINYINT(1) NOT NULL DEFAULT 0 AFTER is_verified;
`;

export const down = `
  ALTER TABLE dietitians DROP COLUMN is_online;
`;
