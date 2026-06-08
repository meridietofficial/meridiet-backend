export const up = `
  ALTER TABLE appointments MODIFY slot TIME NOT NULL;
`;

export const down = `
  ALTER TABLE appointments MODIFY slot VARCHAR(20) NOT NULL;
`;
