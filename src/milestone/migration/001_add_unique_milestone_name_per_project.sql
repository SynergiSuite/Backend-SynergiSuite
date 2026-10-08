-- Milestone Migration 001
-- Prevent duplicate milestone names within the same project, case-insensitively.
-- Existing unassigned milestones may contain historical duplicates, so unassigned
-- uniqueness is enforced in service code until those records are cleaned.

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_milestones_project_name_ci"
ON "milestones" (
  "project_id",
  LOWER("name")
)
WHERE "project_id" IS NOT NULL;
