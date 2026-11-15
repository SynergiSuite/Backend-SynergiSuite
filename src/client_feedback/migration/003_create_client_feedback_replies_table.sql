CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS client_feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL,
  message text NOT NULL,
  business_id int NOT NULL,
  created_by int,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_client_feedback_replies_feedback FOREIGN KEY (feedback_id) REFERENCES client_feedback(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_feedback_replies_user FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_client_feedback_replies_feedback_created ON client_feedback_replies (feedback_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_client_feedback_replies_business ON client_feedback_replies (business_id);
