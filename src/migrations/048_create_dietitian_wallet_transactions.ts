export const up = `
  CREATE TABLE IF NOT EXISTS dietitian_wallet_transactions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    dietitian_id    INT            NOT NULL,
    type            ENUM('credit','debit') NOT NULL,
    source          ENUM('appointment_completion','withdrawal','admin_credit','admin_debit') NOT NULL,
    gross_amount    DECIMAL(10,2)  NOT NULL,
    commission      DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    net_amount      DECIMAL(10,2)  NOT NULL,
    balance_after   DECIMAL(10,2)  NOT NULL,
    description     VARCHAR(255)   NULL,
    reference_id    VARCHAR(255)   NULL,
    appointment_id  INT            NULL,
    created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dwt_dietitian_id (dietitian_id),
    INDEX idx_dwt_appointment_id (appointment_id),
    CONSTRAINT fk_dwt_dietitian FOREIGN KEY (dietitian_id) REFERENCES dietitians(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `
  DROP TABLE IF EXISTS dietitian_wallet_transactions;
`;
