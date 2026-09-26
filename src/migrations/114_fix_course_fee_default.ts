export const up = `
  ALTER TABLE course_enrollments
    ALTER COLUMN course_fee SET DEFAULT 14999.00;

  UPDATE course_enrollments
    SET course_fee = 14999.00
    WHERE course_fee = 24999.00;
`;

export const down = `
  ALTER TABLE course_enrollments
    ALTER COLUMN course_fee SET DEFAULT 24999.00;
`;
