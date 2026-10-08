INSERT INTO primary_roles (id, name, created_at)
SELECT roles.id, roles.name, roles.created_at
FROM roles
WHERE roles.primary_role_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE roles
SET primary_role_id = primary_roles.id
FROM primary_roles
WHERE roles.primary_role_id IS NULL
  AND LOWER(primary_roles.name) = LOWER(roles.name);

SELECT setval(
  pg_get_serial_sequence('primary_roles', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM primary_roles), 1),
  true
);
