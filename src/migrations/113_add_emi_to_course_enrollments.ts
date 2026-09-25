export const up = `
  ALTER TABLE course_enrollments
    ADD COLUMN payment_plan ENUM('full', 'emi') NOT NULL DEFAULT 'full' AFTER phone,
    ADD COLUMN emi_installments_paid TINYINT NOT NULL DEFAULT 0;

  ALTER TABLE course_enrollments
    MODIFY COLUMN payment_status ENUM('pending', 'emi_partial', 'paid', 'failed') NOT NULL DEFAULT 'pending';
`;

export const down = `
  ALTER TABLE course_enrollments
    MODIFY COLUMN payment_status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending';

  ALTER TABLE course_enrollments
    DROP COLUMN emi_installments_paid,
    DROP COLUMN payment_plan;
`;
