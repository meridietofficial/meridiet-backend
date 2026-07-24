export const up = `
  -- Update labels and display_order for existing goals to match app UI
  UPDATE health_goals SET label = 'Weight Loss',       description = 'Lose weight & feel lighter',             display_order = 1  WHERE goal_key = 'weight_loss';
  UPDATE health_goals SET label = 'Muscle Gain',       description = 'Build muscle & get stronger',            display_order = 3  WHERE goal_key = 'muscle_gain';
  UPDATE health_goals SET label = 'PCOS Support',      description = 'Manage PCOS symptoms naturally',         display_order = 4  WHERE goal_key = 'pcod_pcos';
  UPDATE health_goals SET label = 'Maintenance',       description = 'Maintain current weight',                display_order = 6  WHERE goal_key = 'maintenance';
  UPDATE health_goals SET label = 'Improve Energy',    description = 'Boost daily energy levels',              display_order = 7  WHERE goal_key = 'energy_fitness';
  UPDATE health_goals SET label = 'Improve Digestion', description = 'Improve gut health',                     display_order = 10 WHERE goal_key = 'gut_health';

  -- Insert new goals from app UI
  INSERT IGNORE INTO health_goals (goal_key, label, description, display_order, is_active, is_deleted) VALUES
    ('fat_loss',         'Fat Loss',          'Reduce body fat & shape up',           2,  1, 0),
    ('healthy_lifestyle','Healthy Lifestyle',  'Overall health & wellness',             5,  1, 0),
    ('manage_condition', 'Manage Condition',   'Support a medical condition',           8,  1, 0),
    ('hormonal_balance', 'Hormonal Balance',   'Balance hormones naturally',            9,  1, 0),
    ('general_fitness',  'General Fitness',    'Overall fitness',                      11, 1, 0),
    ('other',            'Other',              'Type a custom goal',                   12, 1, 0);
`;

export const down = `
  DELETE FROM health_goals WHERE goal_key IN ('fat_loss','healthy_lifestyle','manage_condition','hormonal_balance','general_fitness','other');

  UPDATE health_goals SET label = 'Muscle Building',     description = 'Build lean muscle mass with high-protein nutrition',      display_order = 3  WHERE goal_key = 'muscle_gain';
  UPDATE health_goals SET label = 'PCOD / PCOS',         description = 'Manage hormonal imbalance and symptoms through diet',     display_order = 7  WHERE goal_key = 'pcod_pcos';
  UPDATE health_goals SET label = 'Maintain Weight',     description = 'Stay at current weight while improving overall health',   display_order = 4  WHERE goal_key = 'maintenance';
  UPDATE health_goals SET label = 'Energy & Fitness',    description = 'Boost daily energy levels and improve overall fitness',   display_order = 10 WHERE goal_key = 'energy_fitness';
  UPDATE health_goals SET label = 'Gut Health',          description = 'Improve digestion and gut microbiome through diet',       display_order = 9  WHERE goal_key = 'gut_health';
`;
