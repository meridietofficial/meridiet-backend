export const up = `
  ALTER TABLE diet_plans
    MODIFY COLUMN status ENUM('generating','completed','failed','draft','archived','sent')
      NOT NULL DEFAULT 'generating',
    ADD COLUMN sent_at DATETIME NULL DEFAULT NULL AFTER pdf_url;
`;

export const down = `
  ALTER TABLE diet_plans
    MODIFY COLUMN status ENUM('generating','completed','failed','draft','archived')
      NOT NULL DEFAULT 'generating',
    DROP COLUMN sent_at;
`;
