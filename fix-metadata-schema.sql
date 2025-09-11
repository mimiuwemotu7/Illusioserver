-- Fix metadata schema to prevent saving empty/null metadata rows
-- This ensures the database only stores meaningful metadata

-- Add constraints to prevent empty metadata from being saved
ALTER TABLE tokens 
ADD CONSTRAINT check_name_not_empty 
CHECK (name IS NULL OR LENGTH(TRIM(name)) > 0);

ALTER TABLE tokens 
ADD CONSTRAINT check_symbol_not_empty 
CHECK (symbol IS NULL OR LENGTH(TRIM(symbol)) > 0);

ALTER TABLE tokens 
ADD CONSTRAINT check_metadata_uri_not_empty 
CHECK (metadata_uri IS NULL OR LENGTH(TRIM(metadata_uri)) > 0);

ALTER TABLE tokens 
ADD CONSTRAINT check_image_url_not_empty 
CHECK (image_url IS NULL OR LENGTH(TRIM(image_url)) > 0);

-- Update existing tokens with empty strings to NULL
UPDATE tokens 
SET name = NULL 
WHERE name = '' OR LENGTH(TRIM(name)) = 0;

UPDATE tokens 
SET symbol = NULL 
WHERE symbol = '' OR LENGTH(TRIM(symbol)) = 0;

UPDATE tokens 
SET metadata_uri = NULL 
WHERE metadata_uri = '' OR LENGTH(TRIM(metadata_uri)) = 0;

UPDATE tokens 
SET image_url = NULL 
WHERE image_url = '' OR LENGTH(TRIM(image_url)) = 0;

-- Add index for faster metadata enrichment queries
CREATE INDEX IF NOT EXISTS idx_tokens_metadata_enrichment 
ON tokens (id) 
WHERE name IS NULL OR symbol IS NULL OR metadata_uri IS NULL;

-- Add function to safely update metadata (only if meaningful)
CREATE OR REPLACE FUNCTION safe_update_token_metadata(
  token_mint VARCHAR,
  new_name TEXT,
  new_symbol TEXT,
  new_metadata_uri TEXT,
  new_image_url TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Only update if the new values are meaningful
  IF (new_name IS NOT NULL AND LENGTH(TRIM(new_name)) > 0) OR
     (new_symbol IS NOT NULL AND LENGTH(TRIM(new_symbol)) > 0) OR
     (new_metadata_uri IS NOT NULL AND LENGTH(TRIM(new_metadata_uri)) > 0) OR
     (new_image_url IS NOT NULL AND LENGTH(TRIM(new_image_url)) > 0) THEN
    
    UPDATE tokens 
    SET 
      name = COALESCE(new_name, name),
      symbol = COALESCE(new_symbol, symbol),
      metadata_uri = COALESCE(new_metadata_uri, metadata_uri),
      image_url = COALESCE(new_image_url, image_url),
      updated_at = CURRENT_TIMESTAMP
    WHERE mint = token_mint;
    
    RETURN FOUND;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION safe_update_token_metadata TO postgres;
