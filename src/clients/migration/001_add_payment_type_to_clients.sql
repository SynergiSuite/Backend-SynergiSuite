DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clients_payment_type_enum') THEN
    CREATE TYPE clients_payment_type_enum AS ENUM ('per_hour', 'each_milestone');
  END IF;
END
$$;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS payment_type clients_payment_type_enum NOT NULL DEFAULT 'per_hour';

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS amount numeric(12, 2) NOT NULL DEFAULT 0;
