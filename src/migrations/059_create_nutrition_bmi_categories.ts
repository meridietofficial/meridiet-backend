export const up = `
  CREATE TABLE IF NOT EXISTS nutrition_bmi_categories (
    id             INT           NOT NULL AUTO_INCREMENT,
    min_bmi        DECIMAL(5,2)  NOT NULL COMMENT 'Lower bound (inclusive)',
    max_bmi        DECIMAL(5,2)           DEFAULT NULL COMMENT 'Upper bound (exclusive). NULL means no upper limit',
    category_name  VARCHAR(50)   NOT NULL COMMENT 'Label shown in plan PDF and API response',
    display_order  TINYINT       NOT NULL DEFAULT 0 COMMENT 'Sort order in admin UI',
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='BMI classification ranges. Uses Indian WHO Asia-Pacific cutoffs (23 overweight, 27.5 obese) instead of Western WHO (25, 30).';

  INSERT IGNORE INTO nutrition_bmi_categories (min_bmi, max_bmi, category_name, display_order) VALUES
    ( 0.00, 18.50, 'Underweight',   1),
    (18.50, 23.00, 'Normal weight', 2),
    (23.00, 27.50, 'Overweight',    3),
    (27.50,  NULL, 'Obese',         4);
`;

export const down = `DROP TABLE IF EXISTS nutrition_bmi_categories;`;
