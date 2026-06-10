export const up = `
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    type           ENUM('credit', 'debit') NOT NULL,
    source         ENUM('recharge', 'admin_credit', 'admin_debit', 'reward', 'purchase') NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    balance_after  DECIMAL(10,2) NOT NULL,
    description    VARCHAR(255) NULL,
    reference_id   VARCHAR(255) NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wallet_user_id (user_id),
    CONSTRAINT fk_wallet_txn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`;

export const down = `
  DROP TABLE IF EXISTS wallet_transactions;
`;
