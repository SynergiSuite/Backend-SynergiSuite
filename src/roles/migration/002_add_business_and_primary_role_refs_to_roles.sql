ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS business_id integer,
  ADD COLUMN IF NOT EXISTS primary_role_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_roles_business'
  ) THEN
    ALTER TABLE roles
      ADD CONSTRAINT fk_roles_business
      FOREIGN KEY (business_id) REFERENCES business(business_id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_roles_primary_role'
  ) THEN
    ALTER TABLE roles
      ADD CONSTRAINT fk_roles_primary_role
      FOREIGN KEY (primary_role_id) REFERENCES primary_roles(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_roles_business_id
  ON roles (business_id);

CREATE INDEX IF NOT EXISTS idx_roles_primary_role_id
  ON roles (primary_role_id);
