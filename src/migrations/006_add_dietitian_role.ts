export const up = `
  ALTER TABLE users
    MODIFY COLUMN role ENUM('user', 'admin', 'dietitian') NOT NULL DEFAULT 'user';
`;

export const down = `
  ALTER TABLE users
    MODIFY COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user';
`;
