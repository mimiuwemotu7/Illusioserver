-- Initialize Solana Mint Discovery Database
-- This script creates the necessary tables and indexes for mint discovery and marketcap tracking

-- Create tokens table for discovered mints
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    mint VARCHAR(255) UNIQUE NOT NULL,
    name TEXT,
    symbol TEXT,
    metadata_uri TEXT,
    image_url TEXT,
    bonding_curve_address TEXT,
    is_on_curve BOOLEAN DEFAULT FALSE,
    decimals INTEGER NOT NULL DEFAULT 0,
    supply BIGINT NOT NULL DEFAULT 0,
    blocktime TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'fresh' CHECK (status IN ('fresh', 'curve', 'active')),
    source VARCHAR(100),
    creator VARCHAR(255),
    website TEXT,
    twitter TEXT,
    telegram TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create marketcaps table for price and market data
CREATE TABLE IF NOT EXISTS marketcaps (
    id SERIAL PRIMARY KEY,
    token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    price_usd DECIMAL(20, 8),
    marketcap DECIMAL(20, 2),
    volume_24h DECIMAL(20, 2),
    liquidity DECIMAL(20, 2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create token_holders table for holder snapshots
CREATE TABLE IF NOT EXISTS token_holders (
    mint TEXT NOT NULL,
    owner TEXT NOT NULL,
    amount NUMERIC NOT NULL,         -- human amount (decimals applied)
    raw_amount TEXT NOT NULL,        -- raw u64 as string
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (mint, owner)
);

-- Create token_holder_summary table for holder count summaries
CREATE TABLE IF NOT EXISTS token_holder_summary (
    mint TEXT PRIMARY KEY,
    holder_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tokens_mint ON tokens(mint);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_is_on_curve ON tokens(is_on_curve);
CREATE INDEX IF NOT EXISTS idx_tokens_blocktime ON tokens(blocktime DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at);
CREATE INDEX IF NOT EXISTS idx_marketcaps_token_id ON marketcaps(token_id);
CREATE INDEX IF NOT EXISTS idx_marketcaps_timestamp ON marketcaps(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_holders_mint_amount ON token_holders (mint, amount DESC);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tokens_updated_at 
    BEFORE UPDATE ON tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
