-- Collab Station Migration 002
-- Adds attachment metadata columns to messages table
-- Makes text nullable for attachment-only messages

-- Add attachment metadata columns
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "fileName" varchar;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "mimeType" varchar;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "fileSize" integer;

-- Make text nullable to support attachment-only messages
ALTER TABLE "messages" ALTER COLUMN "text" DROP NOT NULL;
