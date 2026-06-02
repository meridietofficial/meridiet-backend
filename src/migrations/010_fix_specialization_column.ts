export const up = `
  UPDATE dietitians SET specialization = JSON_ARRAY(specialization) WHERE specialization IS NOT NULL AND specialization != '';
  ALTER TABLE dietitians
    MODIFY COLUMN specialization JSON DEFAULT NULL,
    DROP COLUMN specializations;
`;

export const down = `
  ALTER TABLE dietitians
    MODIFY COLUMN specialization VARCHAR(200) DEFAULT NULL,
    ADD COLUMN specializations JSON DEFAULT NULL AFTER languages;
`;
