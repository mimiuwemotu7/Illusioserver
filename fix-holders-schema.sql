-- token holders snapshot table
CREATE TABLE IF NOT EXISTS token_holders (
  mint TEXT NOT NULL,
  owner TEXT NOT NULL,
  amount NUMERIC NOT NULL,         -- human amount (decimals applied)
  raw_amount TEXT NOT NULL,        -- raw u64 as string
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mint, owner)
);

CREATE INDEX IF NOT EXISTS idx_token_holders_mint_amount
  ON token_holders (mint, amount DESC);

-- optional summary table
CREATE TABLE IF NOT EXISTS token_holder_summary (
  mint TEXT PRIMARY KEY,
  holder_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
