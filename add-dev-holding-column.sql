-- Add dev_holding_percentage column to marketcaps table
ALTER TABLE marketcaps ADD COLUMN IF NOT EXISTS dev_holding_percentage DECIMAL(5, 2) DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_marketcaps_dev_holding ON marketcaps(dev_holding_percentage);

-- Update existing records to have 0 as default value
UPDATE marketcaps SET dev_holding_percentage = 0 WHERE dev_holding_percentage IS NULL;
