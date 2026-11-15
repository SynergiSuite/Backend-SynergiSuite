CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analytics_records_metric_type_enum') THEN
    CREATE TYPE analytics_records_metric_type_enum AS ENUM (
      'employee_productivity',
      'team_execution_velocity',
      'quarterly_growth',
      'client_analytics',
      'overview'
    );
  END IF;
END
$$;

ALTER TYPE analytics_records_metric_type_enum ADD VALUE IF NOT EXISTS 'client_analytics';

CREATE TABLE IF NOT EXISTS analytics_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id int NOT NULL,
  metric_type analytics_records_metric_type_enum NOT NULL,
  scope_type varchar(50),
  scope_id varchar(100),
  scope_name varchar(255),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  score numeric(12, 2) NOT NULL DEFAULT 0,
  data jsonb NOT NULL,
  calculated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_records_business_metric_period
  ON analytics_records (business_id, metric_type, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_analytics_records_business_created
  ON analytics_records (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_records_scope
  ON analytics_records (scope_type, scope_id);
