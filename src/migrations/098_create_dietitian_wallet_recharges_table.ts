export const up = `
  CREATE TABLE IF NOT EXISTS dietitian_wallet_recharges (
    id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    dietitian_id INT NOT NULL,
    amount       DECIMAL(10,2) NOT NULL,
    order_id     VARCHAR(100) NOT NULL UNIQUE,
    payment_id   VARCHAR(100) DEFAULT NULL,
    signature    VARCHAR(255) DEFAULT NULL,
    status       ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dwr_dietitian FOREIGN KEY (dietitian_id) REFERENCES dietitians(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS dietitian_wallet_recharges;`;
