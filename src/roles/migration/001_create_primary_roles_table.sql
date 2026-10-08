CREATE TABLE IF NOT EXISTS primary_roles (
  id serial PRIMARY KEY,
  name varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
