-- DOCQR .NET compatibility patch
-- Date: 2026-03-02
-- Apply after baseline schema migration:
-- packages/database/prisma/migrations/20260223160405_init/migration.sql

ALTER TABLE IF EXISTS dockets
  ADD COLUMN IF NOT EXISTS qr_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qr_token_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_organization TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_phone TEXT,
  ADD COLUMN IF NOT EXISTS sender_address TEXT,
  ADD COLUMN IF NOT EXISTS received_date TIMESTAMPTZ;

ALTER TABLE IF EXISTS docket_attachments
  ADD COLUMN IF NOT EXISTS file_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS hash_algorithm VARCHAR(20),
  ADD COLUMN IF NOT EXISTS hash_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(20) DEFAULT 'unverified';

-- Optional sanity checks
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'dockets' ORDER BY column_name;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'docket_attachments' ORDER BY column_name;
