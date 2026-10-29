-- Keep chat deletion local to an individual group membership.
ALTER TABLE "group_members"
  ADD COLUMN IF NOT EXISTS "chatDeletedAt" TIMESTAMPTZ;
