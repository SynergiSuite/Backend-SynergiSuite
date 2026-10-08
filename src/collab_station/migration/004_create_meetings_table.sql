-- Collab Station Migration 004
-- Creates group meetings and meeting participants for LiveKit-backed meetings

DO $$ BEGIN
  CREATE TYPE meeting_status_enum AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE meeting_participant_role_enum AS ENUM ('host', 'attendee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "meetings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "groupId" uuid NOT NULL,
  "title" varchar NOT NULL,
  "hostId" integer NOT NULL,
  "status" meeting_status_enum NOT NULL DEFAULT 'scheduled',
  "livekitRoomName" varchar NOT NULL,
  "startsAt" timestamptz,
  "startedAt" timestamptz,
  "endedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_meetings" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_meetings_livekitRoomName" UNIQUE ("livekitRoomName"),
  CONSTRAINT "FK_meetings_groupId" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_meetings_hostId" FOREIGN KEY ("hostId") REFERENCES "users"("user_id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "meeting_participants" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "meetingId" uuid NOT NULL,
  "userId" integer NOT NULL,
  "role" meeting_participant_role_enum NOT NULL DEFAULT 'attendee',
  "invitedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt" timestamptz,
  "leftAt" timestamptz,
  CONSTRAINT "PK_meeting_participants" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_meeting_participants_meeting_user" UNIQUE ("meetingId", "userId"),
  CONSTRAINT "FK_meeting_participants_meetingId" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_meeting_participants_userId" FOREIGN KEY ("userId") REFERENCES "users"("user_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_meetings_groupId" ON "meetings" ("groupId");
CREATE INDEX IF NOT EXISTS "IDX_meetings_hostId" ON "meetings" ("hostId");
CREATE INDEX IF NOT EXISTS "IDX_meetings_status" ON "meetings" ("status");
CREATE INDEX IF NOT EXISTS "IDX_meetings_createdAt" ON "meetings" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_meeting_participants_meetingId" ON "meeting_participants" ("meetingId");
CREATE INDEX IF NOT EXISTS "IDX_meeting_participants_userId" ON "meeting_participants" ("userId");
