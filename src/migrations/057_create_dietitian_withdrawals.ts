export const up = `
  CREATE TABLE IF NOT EXISTS dietitian_withdrawals (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    dietitian_id            INT            NOT NULL,
    account_id              INT            NOT NULL,
    amount                  DECIMAL(10,2)  NOT NULL,
    status                  ENUM('pending','processing','processed','failed','reversed','cancelled')
                            NOT NULL DEFAULT 'pending',
    razorpay_payout_id      VARCHAR(100)   NULL,
    razorpay_contact_id     VARCHAR(100)   NULL,
    razorpay_fund_account_id VARCHAR(100)  NULL,
    utr                     VARCHAR(100)   NULL COMMENT 'Unique Transaction Reference from bank',
    failure_reason          TEXT           NULL,
    requested_at            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at            DATETIME       NULL,
    CONSTRAINT fk_dw_dietitian FOREIGN KEY (dietitian_id) REFERENCES dietitians(id),
    CONSTRAINT fk_dw_account   FOREIGN KEY (account_id)   REFERENCES dietitian_payment_accounts(id),
    INDEX idx_dw_dietitian  (dietitian_id),
    INDEX idx_dw_status     (status),
    INDEX idx_dw_payout_id  (razorpay_payout_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `
  DROP TABLE IF EXISTS dietitian_withdrawals;
`;
