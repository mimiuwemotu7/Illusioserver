-- Fix missing token_holders table and related columns
-- This script creates the missing tables and columns needed by the application

BEGIN;

-- Add missing columns to tokens table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='website'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN website TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='twitter'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN twitter TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tokens' AND column_name='telegram'
  ) THEN
    EXECUTE 'ALTER TABLE tokens ADD COLUMN telegram TEXT';
  END IF;
END $$;

-- Create token_holders table if it doesn't exist
CREATE TABLE IF NOT EXISTS token_holders (
    mint TEXT NOT NULL,
    owner TEXT NOT NULL,
    amount NUMERIC NOT NULL,         -- human amount (decimals applied)
    raw_amount TEXT NOT NULL,        -- raw u64 as string
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (mint, owner)
);

-- Create token_holder_summary table if it doesn't exist
CREATE TABLE IF NOT EXISTS token_holder_summary (
    mint TEXT PRIMARY KEY,
    holder_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_token_holders_mint_amount
  ON token_holders (mint, amount DESC);

COMMIT;
