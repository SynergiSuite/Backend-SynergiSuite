CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id int NOT NULL,
  report_name varchar(255) NOT NULL,
  bucket varchar(255) NOT NULL DEFAULT 'reports',
  object_key text NOT NULL,
  content_type varchar(120) NOT NULL DEFAULT 'application/pdf',
  file_size bigint NOT NULL,
  checksum varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_business_created
  ON reports (business_id, created_at DESC);
