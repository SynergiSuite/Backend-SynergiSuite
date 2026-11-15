ALTER TABLE "meeting_recordings"
  ADD COLUMN IF NOT EXISTS "transcript" text,
  ADD COLUMN IF NOT EXISTS "transcriptSegments" jsonb,
  ADD COLUMN IF NOT EXISTS "transcriptLanguage" varchar,
  ADD COLUMN IF NOT EXISTS "transcriptProvider" varchar,
  ADD COLUMN IF NOT EXISTS "transcriptGeneratedAt" timestamptz;

CREATE INDEX IF NOT EXISTS "IDX_meeting_recordings_transcriptGeneratedAt"
ON "meeting_recordings" ("transcriptGeneratedAt" DESC)
WHERE "transcriptGeneratedAt" IS NOT NULL;
