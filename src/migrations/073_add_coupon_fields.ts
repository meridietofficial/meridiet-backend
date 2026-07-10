export const up = `
  ALTER TABLE payments
    ADD COLUMN coupon_id        INT           NULL AFTER user_id,
    ADD COLUMN discount_applied DECIMAL(10,2) NULL,
    ADD COLUMN final_amount     DECIMAL(10,2) NULL,
    ADD CONSTRAINT fk_payments_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE SET NULL;

  ALTER TABLE appointments
    ADD COLUMN coupon_id        INT           NULL AFTER user_id,
    ADD COLUMN discount_applied DECIMAL(10,2) NULL,
    ADD COLUMN final_amount     DECIMAL(10,2) NULL,
    ADD CONSTRAINT fk_appointments_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE SET NULL;
`;

export const down = `
  ALTER TABLE payments
    DROP FOREIGN KEY fk_payments_coupon,
    DROP COLUMN coupon_id,
    DROP COLUMN discount_applied,
    DROP COLUMN final_amount;

  ALTER TABLE appointments
    DROP FOREIGN KEY fk_appointments_coupon,
    DROP COLUMN coupon_id,
    DROP COLUMN discount_applied,
    DROP COLUMN final_amount;
`;
