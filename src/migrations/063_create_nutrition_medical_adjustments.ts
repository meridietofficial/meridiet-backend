export const up = `
  CREATE TABLE IF NOT EXISTS nutrition_medical_adjustments (
    id                      INT            NOT NULL AUTO_INCREMENT,
    condition_key           VARCHAR(50)    NOT NULL COMMENT 'Internal key used in code to identify this condition',
    condition_label         VARCHAR(100)   NOT NULL COMMENT 'Human-readable condition name shown in admin panel',
    detection_keywords      TEXT           NOT NULL COMMENT 'Comma-separated keywords. If any keyword is found in the client medical_conditions field, this row is applied',
    priority                TINYINT        NOT NULL DEFAULT 10 COMMENT 'Lower number = higher priority. When multiple conditions match, the one with lowest priority number wins for protein override',
    fat_percent             DECIMAL(4,2)            DEFAULT NULL COMMENT 'Overrides default fat % of calories. NULL means use default. Example: 0.22 = 22% of calories from fat',
    protein_per_kg_override DECIMAL(4,2)            DEFAULT NULL COMMENT 'Overrides protein per kg calculation. NULL means no override. Example: 0.70 for CKD',
    carb_max_percent        DECIMAL(4,2)            DEFAULT NULL COMMENT 'Caps carbs at this % of total calories. NULL means no cap. Example: 0.45 = max 45% calories from carbs',
    prompt_note             TEXT           NOT NULL COMMENT 'Exact instruction text injected into AI prompt under MEDICAL NUTRITION CONSTRAINTS section',
    is_active               TINYINT(1)     NOT NULL DEFAULT 1,
    created_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_condition_key (condition_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-condition macro overrides and AI prompt instructions. When a client has a matching medical condition, these values override the default calorie/protein/fat/carb calculations.';

  INSERT IGNORE INTO nutrition_medical_adjustments
    (condition_key, condition_label, detection_keywords, priority, fat_percent, protein_per_kg_override, carb_max_percent, prompt_note)
  VALUES
    (
      'ckd',
      'Kidney Disease (CKD)',
      'kidney,ckd,renal,chronic kidney',
      1,
      NULL,
      0.70,
      NULL,
      'Kidney disease (CKD): protein STRICTLY limited to 0.8 g/kg IBW — must not be exceeded. Avoid high-potassium foods (banana, orange, potato, tomato) and high-phosphorus foods (dairy, nuts, cola).'
    ),
    (
      'diabetes',
      'Diabetes / Prediabetes',
      'diabet,prediabet,blood sugar,type 2,type 1,t2dm,t1dm',
      2,
      0.30,
      NULL,
      0.45,
      'Diabetes/Prediabetes: carbohydrates capped at 45% of total calories. Use ONLY low-GI foods (oats, whole grains, legumes, non-starchy vegetables). Absolutely no refined sugar, maida, white rice, or fruit juice.'
    ),
    (
      'pcos',
      'PCOS',
      'pcos,polycyst,polycystic ovary',
      3,
      0.30,
      1.40,
      0.45,
      'PCOS: low-GI anti-inflammatory diet. Emphasise healthy fats (ghee, nuts, seeds, flaxseed), avoid refined carbs and sugar. Meals should be evenly spaced to regulate insulin.'
    ),
    (
      'heart_disease',
      'Heart Disease / High Cholesterol',
      'heart,cardiac,cholesterol,dyslipid,coronary,cvd',
      4,
      0.22,
      NULL,
      NULL,
      'Heart disease/Cholesterol: fat limited to 22% of calories, focus on unsaturated fats (olive oil, mustard oil, walnuts, flaxseed). No ghee, butter, coconut oil, or fried foods. High-fibre foods at every meal.'
    ),
    (
      'hypertension',
      'Hypertension / High Blood Pressure',
      'hypertension,high blood,high bp,blood pressure',
      5,
      NULL,
      NULL,
      NULL,
      'Hypertension: DASH diet approach — strictly low sodium (no added salt, no pickles, papad, processed foods). Emphasise high-potassium foods (banana, sweet potato, spinach, lentils).'
    ),
    (
      'hypothyroid',
      'Hypothyroidism / Thyroid',
      'hypothyroid,thyroid,underactive thyroid',
      6,
      NULL,
      NULL,
      NULL,
      'Hypothyroidism: avoid RAW goitrogens (raw cabbage, cauliflower, broccoli, kale, soy). Cooking neutralises them so cooked forms are fine. Include selenium-rich foods (sunflower seeds, mushrooms, eggs if non-veg).'
    );
`;

export const down = `DROP TABLE IF EXISTS nutrition_medical_adjustments;`;
