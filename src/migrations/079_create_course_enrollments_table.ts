export const up = `
  CREATE TABLE IF NOT EXISTS course_enrollments (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(150)    NOT NULL,
    email                 VARCHAR(254)    NOT NULL,
    phone                 VARCHAR(20)     NOT NULL,
    course_fee            DECIMAL(10,2)   NOT NULL DEFAULT 24999.00,
    payment_status        ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
    razorpay_order_id     VARCHAR(100)    NULL,
    razorpay_payment_id   VARCHAR(100)    NULL,
    razorpay_signature    VARCHAR(512)    NULL,
    payment_verified_at   DATETIME        NULL,
    payment_failed_at     DATETIME        NULL,
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS course_enrollments;`;
