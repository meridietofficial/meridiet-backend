export const up = `
  CREATE TABLE IF NOT EXISTS diet_plans (
    id               INT          NOT NULL AUTO_INCREMENT,
    form_id          INT          NOT NULL,
    user_id          INT                   DEFAULT NULL,

    -- Status
    status           ENUM('generating','completed','failed') NOT NULL DEFAULT 'generating',

    -- Calculated vitals
    bmi              DECIMAL(5,2)          DEFAULT NULL,
    bmi_category     VARCHAR(30)           DEFAULT NULL,
    bmr              DECIMAL(8,2)          DEFAULT NULL,
    tdee             DECIMAL(8,2)          DEFAULT NULL,

    -- Summary fields (flat columns for easy querying)
    client_name      VARCHAR(150)          DEFAULT NULL,
    calorie_range    VARCHAR(50)           DEFAULT NULL,
    primary_goal     VARCHAR(100)          DEFAULT NULL,
    plan_duration    VARCHAR(50)           DEFAULT NULL,
    diet_type        VARCHAR(50)           DEFAULT NULL,
    hydration_guide  TEXT                  DEFAULT NULL,

    -- Complex nested data (stored as JSON)
    client_profile      JSON                  DEFAULT NULL,
    weeks               JSON                  DEFAULT NULL,
    general_tips        JSON                  DEFAULT NULL,
    featured_recipes    JSON                  DEFAULT NULL,

    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_form_id (form_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status  (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS diet_plans;`;
