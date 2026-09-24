export const up = `
  UPDATE app_settings SET value = '14999' WHERE \`key\` = 'course_fee';
`;

export const down = `
  UPDATE app_settings SET value = '24999' WHERE \`key\` = 'course_fee';
`;
