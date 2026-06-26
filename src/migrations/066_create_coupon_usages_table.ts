export const up = `
  CREATE TABLE IF NOT EXISTS coupon_usages (
    id                INT             NOT NULL AUTO_INCREMENT,
    coupon_id         INT             NOT NULL,
    user_id           INT             NULL,
    applicable_type   ENUM('diet_plan','appointment') NOT NULL,
    payment_id        INT             NULL COMMENT 'Set when used on a diet plan purchase',
    appointment_id    INT             NULL COMMENT 'Set when used on an appointment booking',
    original_amount   DECIMAL(10,2)   NOT NULL COMMENT 'Amount before discount',
    discount_applied  DECIMAL(10,2)   NOT NULL COMMENT 'Actual rupees saved',
    final_amount      DECIMAL(10,2)   NOT NULL COMMENT 'Amount actually charged',
    used_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_coupon_id (coupon_id),
    INDEX idx_user_id (user_id),
    INDEX idx_payment_id (payment_id),
    INDEX idx_appointment_id (appointment_id),
    CONSTRAINT fk_cu_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS coupon_usages;`;
