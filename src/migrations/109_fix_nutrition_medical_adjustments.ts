export const up = `
  -- Bug fix: hypothyroid detection keywords also matched 'hyperthyroidism' via the generic 'thyroid' keyword.
  -- Removing 'thyroid' prevents cross-matching; 'hypothyroid' still matches 'hypothyroidism'.
  UPDATE nutrition_medical_adjustments
  SET detection_keywords = 'hypothyroid,underactive thyroid'
  WHERE condition_key = 'hypothyroid';

  -- Add separate hyperthyroidism entry (opposite dietary needs to hypothyroid).
  INSERT IGNORE INTO nutrition_medical_adjustments
    (condition_key, condition_label, detection_keywords, priority, fat_percent, protein_per_kg_override, carb_max_percent, prompt_note)
  VALUES (
    'hyperthyroid',
    'Hyperthyroidism',
    'hyperthyroid,overactive thyroid,graves',
    7,
    NULL,
    1.40,
    NULL,
    'Hyperthyroidism: metabolism is accelerated — calorie needs are 15–20% above the TDEE estimate, so increase portion sizes. Emphasise calcium-rich foods (milk, paneer, curd, ragi) to protect bone density. Include adequate protein (1.4 g/kg). Avoid excess iodine — no large amounts of seaweed or iodine supplements. Avoid stimulants (caffeine, excess spice, alcohol). Do NOT apply goitrogen restrictions that apply to hypothyroidism.'
  );

  -- Bug fix: CKD prompt note said 0.8 g/kg but the actual protein_per_kg_override is 0.70.
  -- Align note to match the calculation.
  UPDATE nutrition_medical_adjustments
  SET prompt_note = 'Kidney disease (CKD): protein STRICTLY limited to 0.7 g/kg IBW — must not be exceeded. Avoid high-potassium foods (banana, orange, potato, tomato) and high-phosphorus foods (dairy in large amounts, nuts, seeds, cola).'
  WHERE condition_key = 'ckd';

  -- Add insulin_resistance to diabetes detection so clients with that condition key get
  -- the carb cap (45%) and fat adjustment applied from the diabetes medical adjustment.
  UPDATE nutrition_medical_adjustments
  SET detection_keywords = 'diabet,prediabet,blood sugar,type 2,type 1,t2dm,t1dm,insulin resistance,metabolic syndrome'
  WHERE condition_key = 'diabetes';

  -- Add high_bp as a detection keyword for hypertension (condition key uses underscore,
  -- so 'high bp' with space won't match it without this addition).
  UPDATE nutrition_medical_adjustments
  SET detection_keywords = 'hypertension,high blood,high bp,blood pressure,high_bp'
  WHERE condition_key = 'hypertension';
`;

export const down = `
  UPDATE nutrition_medical_adjustments
  SET detection_keywords = 'hypothyroid,thyroid,underactive thyroid'
  WHERE condition_key = 'hypothyroid';

  DELETE FROM nutrition_medical_adjustments WHERE condition_key = 'hyperthyroid';

  UPDATE nutrition_medical_adjustments
  SET prompt_note = 'Kidney disease (CKD): protein STRICTLY limited to 0.8 g/kg IBW — must not be exceeded. Avoid high-potassium foods (banana, orange, potato, tomato) and high-phosphorus foods (dairy, nuts, cola).'
  WHERE condition_key = 'ckd';

  UPDATE nutrition_medical_adjustments
  SET detection_keywords = 'diabet,prediabet,blood sugar,type 2,type 1,t2dm,t1dm'
  WHERE condition_key = 'diabetes';

  UPDATE nutrition_medical_adjustments
  SET detection_keywords = 'hypertension,high blood,high bp,blood pressure'
  WHERE condition_key = 'hypertension';
`;
