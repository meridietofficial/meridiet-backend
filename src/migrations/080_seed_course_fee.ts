export const up = `
  INSERT INTO app_settings (\`key\`, value, description)
  VALUES ('course_fee', '24999', 'Course enrollment fee in INR (MeriDiet Professional Nutrition Course)')
  ON DUPLICATE KEY UPDATE description = VALUES(description);
`;

export const down = `DELETE FROM app_settings WHERE \`key\` = 'course_fee';`;
