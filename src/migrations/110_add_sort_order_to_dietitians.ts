export const up = `
  ALTER TABLE dietitians
    ADD COLUMN sort_order INT NOT NULL DEFAULT 9999 AFTER is_under_offer;
`;

export const down = `
  ALTER TABLE dietitians DROP COLUMN sort_order;
`;
