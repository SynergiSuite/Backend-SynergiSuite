DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_recording_status_enum') THEN
    CREATE TYPE meeting_recording_status_enum AS ENUM (
      'starting',
      'active',
      'ending',
      'complete',
      'failed',
      'aborted',
      'limit_reached',
      'unknown'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "meeting_recordings" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "roomName" varchar NOT NULL,
  "egressId" varchar,
  "status" meeting_recording_status_enum NOT NULL DEFAULT 'starting',
  "bucket" varchar NOT NULL,
  "filePath" varchar,
  "fileLocation" varchar,
  "fileSize" bigint,
  "duration" bigint,
  "error" varchar,
  "metadata" jsonb,
  "startedAt" timestamptz,
  "endedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_meeting_recordings" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_meeting_recordings_egressId" UNIQUE ("egressId")
);

CREATE INDEX IF NOT EXISTS "IDX_meeting_recordings_roomName" ON "meeting_recordings" ("roomName");
CREATE INDEX IF NOT EXISTS "IDX_meeting_recordings_egressId" ON "meeting_recordings" ("egressId");
CREATE INDEX IF NOT EXISTS "IDX_meeting_recordings_createdAt" ON "meeting_recordings" ("createdAt" DESC);
