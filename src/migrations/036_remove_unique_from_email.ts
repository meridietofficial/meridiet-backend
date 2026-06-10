export const up = `
  ALTER TABLE users DROP INDEX email;
`;

export const down = `
  ALTER TABLE users ADD UNIQUE INDEX email (email);
`;
