-- Structured shared-item chat messages.
ALTER TYPE message_type_enum ADD VALUE IF NOT EXISTS 'shared_item';

DO $$ BEGIN
  CREATE TYPE messages_shared_entity_type_enum AS ENUM (
    'task',
    'milestone',
    'client_feedback'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "sharedEntityType" messages_shared_entity_type_enum,
  ADD COLUMN IF NOT EXISTS "sharedEntityId" uuid,
  ADD COLUMN IF NOT EXISTS "sharedEntitySnapshot" jsonb;

-- A card is valid message content, so text remains optional.
ALTER TABLE "messages" ALTER COLUMN "text" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_messages_shared_entity"
  ON "messages" ("sharedEntityType", "sharedEntityId");
