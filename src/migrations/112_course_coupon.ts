export const up = `
  ALTER TABLE coupons
    MODIFY COLUMN applicable_on ENUM('diet_plan', 'appointment', 'both', 'course') NOT NULL DEFAULT 'both';

  ALTER TABLE coupon_usages
    MODIFY COLUMN applicable_type ENUM('diet_plan', 'appointment', 'course') NOT NULL;

  ALTER TABLE course_enrollments
    ADD COLUMN coupon_id       INT            NULL AFTER phone,
    ADD COLUMN coupon_code     VARCHAR(50)    NULL AFTER coupon_id,
    ADD COLUMN original_fee    DECIMAL(10,2)  NULL AFTER coupon_code,
    ADD COLUMN discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER original_fee,
    ADD COLUMN amount_paid     DECIMAL(10,2)  NULL AFTER discount_applied;
`;

export const down = `
  ALTER TABLE course_enrollments
    DROP COLUMN amount_paid,
    DROP COLUMN discount_applied,
    DROP COLUMN original_fee,
    DROP COLUMN coupon_code,
    DROP COLUMN coupon_id;

  ALTER TABLE coupon_usages
    MODIFY COLUMN applicable_type ENUM('diet_plan', 'appointment') NOT NULL;

  ALTER TABLE coupons
    MODIFY COLUMN applicable_on ENUM('diet_plan', 'appointment', 'both') NOT NULL DEFAULT 'both';
`;
