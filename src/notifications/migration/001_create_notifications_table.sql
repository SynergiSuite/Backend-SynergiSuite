CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipientId" integer NOT NULL,
  "actorId" integer,
  "type" varchar(64) NOT NULL,
  "title" varchar(180) NOT NULL,
  "body" text,
  "data" jsonb,
  "isRead" boolean NOT NULL DEFAULT false,
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FK_notifications_recipient"
    FOREIGN KEY ("recipientId") REFERENCES "users"("user_id") ON DELETE CASCADE,
  CONSTRAINT "FK_notifications_actor"
    FOREIGN KEY ("actorId") REFERENCES "users"("user_id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_notifications_recipient_unread_created"
  ON "notifications" ("recipientId", "isRead", "createdAt" DESC);
