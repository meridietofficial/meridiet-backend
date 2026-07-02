export const up = `
  INSERT INTO nutrition_general_settings
    (setting_key, value, data_type, category, description)
  VALUES
    ('bmr_weight_coeff',   '10',   'float', 'bmr', 'Mifflin-St Jeor: coefficient multiplied by weight in kg. Standard value is 10.'),
    ('bmr_height_coeff',   '6.25', 'float', 'bmr', 'Mifflin-St Jeor: coefficient multiplied by height in cm. Standard value is 6.25.'),
    ('bmr_age_coeff',      '5',    'float', 'bmr', 'Mifflin-St Jeor: coefficient multiplied by age in years. Standard value is 5.'),
    ('bmr_male_constant',  '5',    'float', 'bmr', 'Mifflin-St Jeor: constant added at the end for males. Standard value is +5.'),
    ('bmr_female_constant','-161', 'float', 'bmr', 'Mifflin-St Jeor: constant added at the end for females. Standard value is -161.');
`;

export const down = `
  DELETE FROM nutrition_general_settings
  WHERE setting_key IN (
    'bmr_weight_coeff',
    'bmr_height_coeff',
    'bmr_age_coeff',
    'bmr_male_constant',
    'bmr_female_constant'
  );
`;
