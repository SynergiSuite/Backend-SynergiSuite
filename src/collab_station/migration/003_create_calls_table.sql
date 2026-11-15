-- Collab Station Migration 003
-- Creates the calls table for voice call tracking

-- Create the call status enum type
DO $$ BEGIN
  CREATE TYPE call_status AS ENUM ('ringing', 'active', 'rejected', 'cancelled', 'missed', 'ended', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the calls table
CREATE TABLE IF NOT EXISTS "calls" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "groupId" uuid NOT NULL,
  "callerId" integer NOT NULL,
  "recipientId" integer NOT NULL,
  "status" call_status NOT NULL DEFAULT 'ringing',
  "livekitRoomName" varchar NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" timestamptz,
  "endedAt" timestamptz,
  CONSTRAINT "PK_calls" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_calls_livekitRoomName" UNIQUE ("livekitRoomName"),
  CONSTRAINT "FK_calls_groupId" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_calls_callerId" FOREIGN KEY ("callerId") REFERENCES "users"("user_id") ON DELETE CASCADE,
  CONSTRAINT "FK_calls_recipientId" FOREIGN KEY ("recipientId") REFERENCES "users"("user_id") ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "IDX_calls_groupId" ON "calls" ("groupId");
CREATE INDEX IF NOT EXISTS "IDX_calls_callerId" ON "calls" ("callerId");
CREATE INDEX IF NOT EXISTS "IDX_calls_recipientId" ON "calls" ("recipientId");
CREATE INDEX IF NOT EXISTS "IDX_calls_callerId_status" ON "calls" ("callerId", "status");
CREATE INDEX IF NOT EXISTS "IDX_calls_recipientId_status" ON "calls" ("recipientId", "status");
CREATE INDEX IF NOT EXISTS "IDX_calls_createdAt" ON "calls" ("createdAt" DESC);
