ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignee_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_assignee'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_assignee
      FOREIGN KEY (assignee_id) REFERENCES users(user_id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id
  ON tasks (assignee_id);
