export const up = `
  ALTER TABLE diet_plans
  ADD COLUMN pdf_url VARCHAR(500) NULL DEFAULT NULL;
`;

export const down = `
  ALTER TABLE diet_plans DROP COLUMN pdf_url;
`;
