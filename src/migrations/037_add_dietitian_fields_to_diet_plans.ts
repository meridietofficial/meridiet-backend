export const up = `
  ALTER TABLE diet_plans
    ADD COLUMN dietitian_id   INT  NULL AFTER user_id,
    ADD COLUMN appointment_id INT  NULL AFTER dietitian_id,
    ADD COLUMN notes          TEXT NULL AFTER featured_recipes,
    MODIFY COLUMN status ENUM('generating','completed','failed','draft','archived')
      NOT NULL DEFAULT 'generating';
`;

export const down = `
  ALTER TABLE diet_plans
    DROP COLUMN notes,
    DROP COLUMN appointment_id,
    DROP COLUMN dietitian_id,
    MODIFY COLUMN status ENUM('generating','completed','failed')
      NOT NULL DEFAULT 'generating';
`;
