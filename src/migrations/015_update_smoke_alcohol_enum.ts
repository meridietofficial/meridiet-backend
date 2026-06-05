export const up = `
  ALTER TABLE diet_forms
    MODIFY COLUMN smoke_alcohol ENUM('neither','smoke','occasionally_smoke','alcohol','occasionally_drink','both') DEFAULT NULL;
`;

export const down = `
  ALTER TABLE diet_forms
    MODIFY COLUMN smoke_alcohol ENUM('neither','smoke','alcohol','both') DEFAULT NULL;
`;
