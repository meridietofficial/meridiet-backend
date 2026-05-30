export const up = `
  CREATE TABLE IF NOT EXISTS payments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    razorpay_order_id   VARCHAR(100)   NOT NULL UNIQUE,
    razorpay_payment_id VARCHAR(100)   DEFAULT NULL,
    razorpay_signature  VARCHAR(255)   DEFAULT NULL,
    plan                VARCHAR(20)    NOT NULL,
    amount              DECIMAL(10,2)  NOT NULL COMMENT 'amount in INR',
    currency            VARCHAR(10)    NOT NULL DEFAULT 'INR',
    status              ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
    user_id             INT            DEFAULT NULL,
    diet_form_id        INT            DEFAULT NULL,
    created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (diet_form_id) REFERENCES diet_forms(id) ON DELETE SET NULL
  );
`;

export const down = `DROP TABLE IF EXISTS payments;`;
