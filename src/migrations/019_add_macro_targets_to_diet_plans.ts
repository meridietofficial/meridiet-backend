export const up = `
  ALTER TABLE diet_plans
    ADD COLUMN protein_target_g  DECIMAL(6,1) DEFAULT NULL AFTER calorie_range,
    ADD COLUMN carbs_target_g    DECIMAL(6,1) DEFAULT NULL AFTER protein_target_g,
    ADD COLUMN fat_target_g      DECIMAL(6,1) DEFAULT NULL AFTER carbs_target_g;
`;

export const down = `
  ALTER TABLE diet_plans
    DROP COLUMN protein_target_g,
    DROP COLUMN carbs_target_g,
    DROP COLUMN fat_target_g;
`;
