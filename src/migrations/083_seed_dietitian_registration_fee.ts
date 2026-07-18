export const up = `
  INSERT INTO app_settings (\`key\`, value, description)
  VALUES ('dietitian_registration_fee', '2499', 'One-time registration fee charged to dietitians on sign-up (INR)')
  ON DUPLICATE KEY UPDATE description = VALUES(description);
`;

export const down = `DELETE FROM app_settings WHERE \`key\` = 'dietitian_registration_fee';`;
