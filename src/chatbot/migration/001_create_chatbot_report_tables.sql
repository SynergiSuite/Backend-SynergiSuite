CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_report_jobs_status_enum') THEN
    CREATE TYPE chatbot_report_jobs_status_enum AS ENUM (
      'pending',
      'running',
      'success',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatbot_report_files_job_type_enum') THEN
    CREATE TYPE chatbot_report_files_job_type_enum AS ENUM (
      'business',
      'team',
      'employee'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS chatbot_report_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id int NOT NULL,
  job_name varchar(120) NOT NULL,
  status chatbot_report_jobs_status_enum NOT NULL DEFAULT 'pending',
  last_successful_run timestamptz,
  next_due_at timestamptz,
  error_message text,
  generated_pdf_bucket varchar(255),
  generated_pdf_key text,
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_chatbot_report_jobs_business_job UNIQUE (business_id, job_name)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_report_jobs_due_status
  ON chatbot_report_jobs (next_due_at, status);

CREATE TABLE IF NOT EXISTS chatbot_report_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id int NOT NULL,
  bucket varchar(255) NOT NULL,
  object_key text NOT NULL,
  generated_at timestamptz NOT NULL,
  job_type chatbot_report_files_job_type_enum NOT NULL,
  report_period_start timestamptz NOT NULL,
  report_period_end timestamptz NOT NULL,
  entity_type varchar(50),
  entity_id varchar(120),
  entity_name varchar(255),
  file_size bigint,
  checksum varchar(128),
  content_type varchar(120) NOT NULL DEFAULT 'application/pdf',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chatbot_report_files_business_generated
  ON chatbot_report_files (business_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatbot_report_files_entity
  ON chatbot_report_files (entity_type, entity_id);
