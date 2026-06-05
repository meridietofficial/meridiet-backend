export const up = `
  ALTER TABLE diet_forms ADD COLUMN plan_type INT DEFAULT NULL AFTER user_id;
`;

export const down = `
  ALTER TABLE diet_forms DROP COLUMN plan_type;
`;
