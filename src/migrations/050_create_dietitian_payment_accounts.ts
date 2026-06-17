export const up = `
  CREATE TABLE IF NOT EXISTS dietitian_payment_accounts (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    dietitian_id   INT          NOT NULL,
    type           ENUM('upi', 'bank') NOT NULL,
    is_primary     TINYINT(1)   NOT NULL DEFAULT 0,
    -- UPI fields
    upi_id         VARCHAR(100) NULL,
    -- Bank fields
    account_holder VARCHAR(100) NULL,
    account_number VARCHAR(50)  NULL,
    ifsc_code      VARCHAR(20)  NULL,
    bank_name      VARCHAR(100) NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dpa_dietitian_id (dietitian_id),
    CONSTRAINT fk_dpa_dietitian FOREIGN KEY (dietitian_id) REFERENCES dietitians(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `
  DROP TABLE IF EXISTS dietitian_payment_accounts;
`;
