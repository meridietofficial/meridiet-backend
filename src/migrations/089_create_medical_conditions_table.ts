export const up = `
  CREATE TABLE IF NOT EXISTS medical_conditions (
    id              INT           NOT NULL AUTO_INCREMENT,
    condition_key   VARCHAR(50)   NOT NULL,
    label           VARCHAR(100)  NOT NULL,
    description     VARCHAR(255)           DEFAULT NULL,
    display_order   TINYINT       NOT NULL DEFAULT 0,
    is_active       TINYINT(1)    NOT NULL DEFAULT 1,
    is_deleted      TINYINT(1)    NOT NULL DEFAULT 0,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_condition_key (condition_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Medical conditions shown during onboarding for diet personalisation. Managed via admin panel.';

  INSERT IGNORE INTO medical_conditions (condition_key, label, description, display_order, is_active, is_deleted) VALUES
    ('none',               'None',                        'No known medical conditions',                                          1,  1, 0),
    ('diabetes',           'Diabetes',                    'Type 1 or Type 2 diabetes requiring blood sugar management',           2,  1, 0),
    ('pre_diabetes',       'Pre-Diabetes',                'Borderline blood sugar — insulin resistance or impaired fasting',      3,  1, 0),
    ('hypothyroidism',     'Hypothyroidism',              'Underactive thyroid — slow metabolism, weight gain tendency',          4,  1, 0),
    ('hyperthyroidism',    'Hyperthyroidism',             'Overactive thyroid — fast metabolism, difficulty gaining weight',      5,  1, 0),
    ('pcos_pcod',          'PCOS / PCOD',                 'Hormonal imbalance affecting metabolism and weight',                   6,  1, 0),
    ('high_bp',            'High BP',                     'Hypertension — requires low-sodium, heart-friendly diet',             7,  1, 0),
    ('low_bp',             'Low BP',                      'Hypotension — requires adequate salt and hydration',                  8,  1, 0),
    ('high_cholesterol',   'High Cholesterol',            'Elevated LDL or triglycerides — requires low-fat diet',               9,  1, 0),
    ('heart_condition',    'Heart Condition',             'CAD, heart failure or post-surgery cardiac diet needs',               10,  1, 0),
    ('fatty_liver',        'Fatty Liver',                 'Non-alcoholic fatty liver disease (NAFLD) — needs low-fat, low-sugar',11,  1, 0),
    ('kidney_disease',     'Kidney Disease',              'CKD — requires restricted protein, potassium and phosphorus',         12,  1, 0),
    ('uric_acid_gout',     'Uric Acid / Gout',            'High uric acid — needs low-purine diet, avoid red meat and alcohol',  13,  1, 0),
    ('anemia',             'Anaemia / Iron Deficiency',   'Low haemoglobin — requires iron and B12-rich foods',                  14,  1, 0),
    ('vitamin_d',          'Vitamin D Deficiency',        'Low Vitamin D — needs calcium and D-rich foods plus sunlight',        15,  1, 0),
    ('vitamin_b12',        'Vitamin B12 Deficiency',      'Common in vegetarians — affects energy and nerve health',             16,  1, 0),
    ('osteoporosis',       'Osteoporosis / Weak Bones',   'Low bone density — requires high calcium and Vitamin D diet',         17,  1, 0),
    ('ibs',                'IBS / Irritable Bowel',       'Gut sensitivity — requires low-FODMAP or easy-to-digest meals',       18,  1, 0),
    ('gerd_acid_reflux',   'GERD / Acid Reflux',          'Chronic acidity — avoid spicy, fried and acidic foods',              19,  1, 0),
    ('arthritis',          'Arthritis / Joint Pain',      'Inflammation in joints — requires anti-inflammatory diet',            20,  1, 0),
    ('other',              'Other',                       'Any other medical condition not listed above',                        21,  1, 0);
`;

export const down = `DROP TABLE IF EXISTS medical_conditions;`;
