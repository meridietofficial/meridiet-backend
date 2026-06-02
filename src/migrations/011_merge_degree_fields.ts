export const up = `
  UPDATE dietitians
    SET degrees = JSON_ARRAY(JSON_OBJECT('degree', highest_degree, 'institute', '', 'year', NULL))
    WHERE highest_degree IS NOT NULL
      AND highest_degree != ''
      AND (degrees IS NULL OR JSON_LENGTH(degrees) = 0);

  ALTER TABLE dietitians DROP COLUMN highest_degree;
`;

export const down = `
  ALTER TABLE dietitians ADD COLUMN highest_degree VARCHAR(200) DEFAULT NULL AFTER experience;

  UPDATE dietitians
    SET highest_degree = JSON_UNQUOTE(JSON_EXTRACT(degrees, '$[0].degree'))
    WHERE degrees IS NOT NULL AND JSON_LENGTH(degrees) > 0;
`;
