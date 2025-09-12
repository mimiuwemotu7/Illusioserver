-- Fix missing token_holders table
-- Run this if the table creation in ensureSchema() fails

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

-- Verify tables were created
SELECT 'token_holders table created' as status WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'token_holders'
);

SELECT 'token_holder_summary table created' as status WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'token_holder_summary'
);
