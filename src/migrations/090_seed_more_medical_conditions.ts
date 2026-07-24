export const up = `
  -- Push 'other' to always stay last
  UPDATE medical_conditions SET display_order = 99 WHERE condition_key = 'other';

  INSERT IGNORE INTO medical_conditions (condition_key, label, description, display_order, is_active, is_deleted) VALUES
    -- Weight & Metabolism
    ('obesity',               'Obesity / Overweight',          'High body fat — diet is the primary treatment tool',                        22, 1, 0),
    ('underweight',           'Underweight / Low BMI',         'Below healthy weight — needs calorie-dense nutritious meals',               23, 1, 0),
    ('high_triglycerides',    'High Triglycerides',            'Elevated blood fats — managed by reducing sugar and refined carbs',         24, 1, 0),
    ('metabolic_syndrome',    'Metabolic Syndrome',            'Cluster of high BP, sugar, fat and waist issues — fully diet-responsive',   25, 1, 0),
    ('insulin_resistance',    'Insulin Resistance',            'Cells do not respond to insulin well — managed with low-GI diet',           26, 1, 0),
    ('muscle_loss',           'Muscle Loss / Weakness',        'Sarcopenia or low muscle mass — requires high-protein diet',                27, 1, 0),
    ('water_retention',       'Water Retention / Bloating',    'Fluid retention in body — managed by low-sodium and diuretic foods',        28, 1, 0),

    -- Digestive & Gut
    ('constipation',          'Constipation',                  'Irregular bowel movements — high-fibre and hydration-focused diet',         29, 1, 0),
    ('bloating_gas',          'Bloating / Gas',                'Frequent bloating or flatulence — managed with gut-friendly foods',         30, 1, 0),
    ('gastritis',             'Gastritis / Stomach Ulcer',     'Stomach lining inflammation — requires bland, low-acid diet',              31, 1, 0),
    ('celiac',                'Celiac Disease',                'Gluten intolerance — requires strict gluten-free diet plan',               32, 1, 0),
    ('chronic_inflammation',  'Chronic Inflammation',          'Persistent body inflammation — managed with anti-inflammatory foods',       33, 1, 0),

    -- Nutritional Deficiencies
    ('calcium_deficiency',    'Calcium Deficiency',            'Low calcium affecting bones and muscles — needs dairy and fortified foods',  34, 1, 0),
    ('magnesium_deficiency',  'Magnesium Deficiency',          'Low magnesium causing cramps and fatigue — found in nuts, seeds, greens',   35, 1, 0),
    ('zinc_deficiency',       'Zinc Deficiency',               'Low zinc affecting immunity and skin — found in legumes, seeds, meat',      36, 1, 0),
    ('folate_deficiency',     'Folate Deficiency',             'Low folic acid — critical during pregnancy, found in leafy greens',         37, 1, 0),

    -- Skin, Hair & Energy
    ('acne_skin',             'Acne / Skin Issues',            'Diet-triggered acne — low-GI, anti-inflammatory foods can help',           38, 1, 0),
    ('hair_loss',             'Hair Loss / Thinning',          'Nutritional deficiency-linked hair fall — iron, protein and biotin focus',  39, 1, 0),
    ('chronic_fatigue',       'Chronic Fatigue',               'Persistent tiredness — often linked to diet and deficiencies',             40, 1, 0),
    ('poor_sleep',            'Poor Sleep / Insomnia',         'Sleep issues — managed with tryptophan-rich and low-caffeine diet',         41, 1, 0),

    -- Women''s Health
    ('pms',                   'PMS / Menstrual Issues',        'Bloating, cramps, mood swings — managed with magnesium and iron-rich diet', 42, 1, 0),
    ('menopause',             'Menopause / Perimenopause',     'Hormonal shift — phytoestrogen and calcium-rich diet helps symptoms',       43, 1, 0),
    ('postpartum',            'Postpartum Recovery',           'Post-delivery nutrition — iron, calcium and lactation support',             44, 1, 0),

    -- Immunity & General
    ('low_immunity',          'Low Immunity',                  'Frequent illness — boosted with Vitamin C, D, zinc-rich foods',             45, 1, 0),
    ('stress_anxiety',        'Stress / Anxiety',              'Diet can support cortisol balance with adaptogens and B-vitamins',          46, 1, 0),
    ('brain_fog',             'Brain Fog / Poor Focus',        'Cognitive sluggishness — improved with omega-3, B12 and iron-rich diet',    47, 1, 0),
    ('eczema_psoriasis',      'Eczema / Psoriasis',            'Skin inflammation — triggered and relieved by specific foods',              48, 1, 0);
`;

export const down = `
  DELETE FROM medical_conditions WHERE condition_key IN (
    'obesity','underweight','high_triglycerides','metabolic_syndrome','insulin_resistance',
    'muscle_loss','water_retention','constipation','bloating_gas','gastritis','celiac',
    'chronic_inflammation','calcium_deficiency','magnesium_deficiency','zinc_deficiency',
    'folate_deficiency','acne_skin','hair_loss','chronic_fatigue','poor_sleep','pms',
    'menopause','postpartum','low_immunity','stress_anxiety','brain_fog','eczema_psoriasis'
  );
  UPDATE medical_conditions SET display_order = 21 WHERE condition_key = 'other';
`;
