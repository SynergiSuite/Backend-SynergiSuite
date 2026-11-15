CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_feedback_target_type_enum') THEN
    CREATE TYPE client_feedback_target_type_enum AS ENUM ('project', 'milestone', 'task');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_feedback_type_enum') THEN
    CREATE TYPE client_feedback_type_enum AS ENUM ('request', 'review', 'issue', 'question', 'approval', 'general');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_feedback_status_enum') THEN
    CREATE TYPE client_feedback_status_enum AS ENUM ('open', 'in_progress', 'in_review', 'resolved', 'rejected');
  END IF;
END
$$;

ALTER TYPE client_feedback_status_enum ADD VALUE IF NOT EXISTS 'in_progress';

CREATE TABLE IF NOT EXISTS client_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_of_feedback varchar(150) NOT NULL DEFAULT 'Client feedback',
  star_rating int,
  feedback text NOT NULL,
  feedback_type client_feedback_type_enum NOT NULL DEFAULT 'general',
  target_type client_feedback_target_type_enum NOT NULL,
  type_id uuid NOT NULL,
  status client_feedback_status_enum NOT NULL DEFAULT 'open',
  business_id int NOT NULL,
  client_id uuid NOT NULL,
  created_by int,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_client_feedback_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_feedback_user FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_client_feedback_business_created ON client_feedback (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_feedback_client ON client_feedback (client_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_target ON client_feedback (target_type, type_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_status ON client_feedback (status);

ALTER TABLE client_feedback
ADD COLUMN IF NOT EXISTS title_of_feedback varchar(150) NOT NULL DEFAULT 'Client feedback';

ALTER TABLE client_feedback
ADD COLUMN IF NOT EXISTS star_rating int;

ALTER TABLE client_feedback
ADD COLUMN IF NOT EXISTS status client_feedback_status_enum NOT NULL DEFAULT 'open';
