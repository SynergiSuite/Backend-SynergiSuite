CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_logs_action_enum') THEN
    CREATE TYPE activity_logs_action_enum AS ENUM ('created', 'updated', 'deleted');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action activity_logs_action_enum NOT NULL,
  module varchar(50) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id varchar(100) NOT NULL,
  entity_name varchar(255),
  field_changed varchar(100),
  old_value text,
  new_value text,
  user_id int,
  user_name varchar(100),
  user_email varchar(255),
  business_id int,
  description text NOT NULL,
  before jsonb,
  after jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_business_created
  ON activity_logs (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON activity_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON activity_logs (user_id);
