-- Add visit_attendance column for tracking site visit attendance decisions
-- Values: NULL (undecided), 'attending', 'skipped'
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS visit_attendance TEXT DEFAULT NULL;
