-- Add quote_url column for the bidding portal link from the email body
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS quote_url TEXT;
