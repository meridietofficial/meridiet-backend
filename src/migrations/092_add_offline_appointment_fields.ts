export const up = `
  ALTER TABLE appointments
    ADD COLUMN appointment_source  ENUM('platform', 'dietitian') NOT NULL DEFAULT 'platform' AFTER order_id,
    ADD COLUMN payment_method      ENUM('razorpay', 'cash', 'upi', 'card', 'other')          DEFAULT NULL AFTER appointment_source,
    ADD COLUMN diet_plan_sent      TINYINT(1)   NOT NULL DEFAULT 0                            AFTER dietitian_notes,
    ADD COLUMN diet_plan_file_url  VARCHAR(500)          DEFAULT NULL                         AFTER diet_plan_sent;
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN appointment_source,
    DROP COLUMN payment_method,
    DROP COLUMN diet_plan_sent,
    DROP COLUMN diet_plan_file_url;
`;
