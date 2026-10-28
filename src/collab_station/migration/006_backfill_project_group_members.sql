-- One-time repair for project chat groups created before membership sync.
WITH expected_members AS (
  SELECT g.id AS group_id, g."createdById" AS user_id, 'admin'::group_member_role_enum AS role
  FROM "groups" g
  WHERE g.type = 'project' AND g."createdById" IS NOT NULL

  UNION

  SELECT g.id, t.leader_id, 'member'::group_member_role_enum
  FROM "groups" g
  JOIN project_teams pt ON pt.project_id = g."projectId"
  JOIN team t ON t.id = pt.team_id
  WHERE g.type = 'project' AND t.leader_id IS NOT NULL

  UNION

  SELECT g.id, tm."userUserId", 'member'::group_member_role_enum
  FROM "groups" g
  JOIN project_teams pt ON pt.project_id = g."projectId"
  JOIN team_members tm ON tm."teamId" = pt.team_id
  WHERE g.type = 'project' AND tm."userUserId" IS NOT NULL
)
INSERT INTO group_members (id, "userId", "groupId", role, "isMuted", "joinedAt")
SELECT uuid_generate_v4(), expected.user_id, expected.group_id, expected.role, false, CURRENT_TIMESTAMP
FROM expected_members expected
ON CONFLICT ("userId", "groupId") DO NOTHING;
