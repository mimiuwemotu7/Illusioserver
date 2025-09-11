-- Database Migration Script to Fix Schema Issues
-- Run this against your Postgres database to fix the missing columns and constraints

BEGIN;

-- New columns used by your metadata enricher + UI
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='metadata_uri'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN metadata_uri TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='image_url'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN image_url TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='bonding_curve_address'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN bonding_curve_address TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='is_on_curve'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN is_on_curve BOOLEAN DEFAULT FALSE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='name'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN name TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='symbol'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN symbol TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='source'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN source VARCHAR(100)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='creator'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN creator VARCHAR(255)';
  END IF;
END $$;

-- Rename contract_address to mint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='contract_address'
  ) THEN
    EXECUTE 'ALTER TABLE tokens RENAME COLUMN contract_address TO mint';
  END IF;
END $$;

-- Allow empty name/symbol at insert time (we'll enrich later)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='name' AND is_nullable='NO'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ALTER COLUMN name DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='symbol' AND is_nullable='NO'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ALTER COLUMN symbol DROP NOT NULL';
  END IF;
END $$;

-- Reset the status check constraint to allow 'fresh' | 'curve' | 'active'
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname
  INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'tokens'
    AND c.conname = 'tokens_status_check';

  IF conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE tokens DROP CONSTRAINT tokens_status_check';
  END IF;
END $$;

ALTER TABLE tokens
  ADD CONSTRAINT tokens_status_check
  CHECK (status IN ('fresh','curve','active'));

-- Helpful indexes (optional)
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_is_on_curve ON tokens(is_on_curve);
CREATE INDEX IF NOT EXISTS idx_tokens_mint ON tokens(mint);

-- Update any existing tokens to have default values
UPDATE tokens SET 
  name = COALESCE(name, 'Unknown'),
  symbol = COALESCE(symbol, 'UNK'),
  source = COALESCE(source, 'unknown'),
  is_on_curve = COALESCE(is_on_curve, false)
WHERE name IS NULL OR symbol IS NULL OR source IS NULL OR is_on_curve IS NULL;

-- Show the current state after migration
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE name IS NULL OR name='') AS no_name,
  COUNT(*) FILTER (WHERE symbol IS NULL OR symbol='') AS no_symbol,
  COUNT(*) FILTER (WHERE metadata_uri IS NULL OR metadata_uri='') AS no_uri,
  COUNT(*) FILTER (WHERE image_url IS NULL OR image_url='') AS no_image,
  COUNT(*) FILTER (WHERE is_on_curve = true) AS curve_tokens
FROM tokens;

COMMIT;
