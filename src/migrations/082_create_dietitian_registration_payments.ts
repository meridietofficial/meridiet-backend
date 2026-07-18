export const up = `
  CREATE TABLE IF NOT EXISTS dietitian_registration_payments (
    id                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    email                 VARCHAR(254)    NOT NULL UNIQUE,
    registration_data     JSON            NOT NULL,
    amount                DECIMAL(10,2)   NOT NULL DEFAULT 2499.00,
    razorpay_order_id     VARCHAR(100)    NULL,
    razorpay_payment_id   VARCHAR(100)    NULL,
    razorpay_signature    VARCHAR(512)    NULL,
    status                ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
    payment_verified_at   DATETIME        NULL,
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_razorpay_order_id (razorpay_order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS dietitian_registration_payments;`;
