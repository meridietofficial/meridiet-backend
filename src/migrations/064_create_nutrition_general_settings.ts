export const up = `
  CREATE TABLE IF NOT EXISTS nutrition_general_settings (
    id           INT           NOT NULL AUTO_INCREMENT,
    setting_key  VARCHAR(100)  NOT NULL COMMENT 'Unique key used in code to read this value',
    value        VARCHAR(50)   NOT NULL COMMENT 'The actual value stored as a string. Cast to int or float in code based on data_type',
    data_type    ENUM('int','float') NOT NULL DEFAULT 'float' COMMENT 'Tells the admin UI and code what type to cast this value to',
    category     VARCHAR(50)   NOT NULL COMMENT 'Groups related settings together in the admin panel',
    description  VARCHAR(255)  NOT NULL COMMENT 'Plain English explanation of what this setting does and why it exists',
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_setting_key (setting_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Scalar nutrition config values that do not fit into the other nutrition tables. Admin can edit any value here without code changes.';

  INSERT IGNORE INTO nutrition_general_settings (setting_key, value, data_type, category, description) VALUES

    -- Macro defaults
    ('default_fat_percent',       '0.27', 'float', 'macros',       'Default % of daily calories from fat for healthy clients with no medical condition. Example: 0.27 = 27%.'),
    ('protein_range_tolerance',   '0.10', 'float', 'macros',       'How wide the protein min/max range is around the target. 0.10 means target -10% to +10%. Example: target 100g → range 90g–110g.'),
    ('min_carbs_per_day',         '130',  'int',   'macros',       'Hard floor for daily carbohydrate intake in grams. The brain needs minimum 130g/day of glucose. Plan will never go below this.'),

    -- Ideal Body Weight (IBW) formula — used for protein calculation in overweight/obese clients
    ('ibw_bmi_threshold',         '27.5', 'float', 'protein_ibw',  'BMI value above which Ideal Body Weight is used instead of actual weight for protein calculation. Prevents inflated protein targets for obese clients.'),
    ('severe_obese_bmi_threshold','35.0', 'float', 'protein_ibw',  'BMI above which Adjusted Body Weight formula is used: IBW + factor x (actual - IBW). More accurate than plain IBW for severely obese clients.'),
    ('adjusted_bw_factor',        '0.40', 'float', 'protein_ibw',  'Factor used in Adjusted Body Weight formula. Formula: IBW + this_factor x (actual_weight - IBW). Clinical standard is 0.4.'),
    ('ibw_male_base_kg',          '50.0', 'float', 'protein_ibw',  'Devine formula IBW base weight for males at exactly 5 feet (152.4 cm) height. Formula: 50 + 2.3 x (height_inches - 60).'),
    ('ibw_female_base_kg',        '45.5', 'float', 'protein_ibw',  'Devine formula IBW base weight for females at exactly 5 feet (152.4 cm) height. Formula: 45.5 + 2.3 x (height_inches - 60).'),
    ('ibw_per_inch_kg',           '2.3',  'float', 'protein_ibw',  'Devine formula — kg of IBW added per inch of height above 5 feet. Applied equally for both male and female.'),

    -- Elderly protein adjustment
    ('elderly_age_threshold',      '60',  'int',   'elderly',      'Age at which clients are considered elderly and receive a higher protein floor. Set to prevent sarcopenia (age-related muscle loss).'),
    ('elderly_min_protein_per_kg', '1.4', 'float', 'elderly',      'Minimum protein per kg applied to clients above the elderly age threshold. Overrides lower goal-based targets unless client has CKD.');
`;

export const down = `DROP TABLE IF EXISTS nutrition_general_settings;`;
