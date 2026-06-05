export const up = `
  ALTER TABLE diet_forms DROP COLUMN preferred_meals;
`;

export const down = `
  ALTER TABLE diet_forms ADD COLUMN preferred_meals JSON DEFAULT NULL AFTER cuisine_preference;
`;
