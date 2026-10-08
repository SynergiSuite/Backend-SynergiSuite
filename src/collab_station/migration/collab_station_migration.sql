-- Collab Station Migration
-- Creates 3 new tables: groups, group_members, messages

-- Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
DO $$ BEGIN
  CREATE TYPE group_type_enum AS ENUM ('team', 'project', 'custom', 'direct');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE group_member_role_enum AS ENUM ('admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type_enum AS ENUM ('text', 'image', 'file', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create groups table
CREATE TABLE IF NOT EXISTS "groups" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" varchar,
  "type" group_type_enum NOT NULL,
  "description" varchar,
  "avatarUrl" varchar,
  "teamId" uuid UNIQUE,
  "projectId" uuid UNIQUE,
  "createdById" integer,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FK_groups_team" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL,
  CONSTRAINT "FK_groups_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL,
  CONSTRAINT "FK_groups_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("user_id") ON DELETE SET NULL
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS "group_members" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" integer NOT NULL,
  "groupId" uuid NOT NULL,
  "role" group_member_role_enum NOT NULL DEFAULT 'member',
  "isMuted" boolean NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UQ_group_members_user_group" UNIQUE ("userId", "groupId"),
  CONSTRAINT "FK_group_members_user" FOREIGN KEY ("userId") REFERENCES "users"("user_id") ON DELETE CASCADE,
  CONSTRAINT "FK_group_members_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE
);

-- Create messages table
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "groupId" uuid NOT NULL,
  "senderId" integer,
  "text" text NOT NULL,
  "type" message_type_enum NOT NULL DEFAULT 'text',
  "fileUrl" varchar,
  "replyToId" uuid,
  "isEdited" boolean NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ,
  CONSTRAINT "FK_messages_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("user_id") ON DELETE SET NULL,
  CONSTRAINT "FK_messages_replyTo" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL
);

-- Create index on messages.groupId for fast lookups
CREATE INDEX IF NOT EXISTS "IDX_messages_groupId" ON "messages" ("groupId");
