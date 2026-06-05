export const up = `
  ALTER TABLE contact_us MODIFY COLUMN email VARCHAR(255) DEFAULT NULL;
`;

export const down = `
  ALTER TABLE contact_us MODIFY COLUMN email VARCHAR(255) NOT NULL;
`;
