-- Add Substack URL to bible_studies for leader notes (e.g. Jason's notes at jasondavidsnyder.substack.com)
-- Run in Supabase SQL Editor. Idempotent.

ALTER TABLE bible_studies ADD COLUMN IF NOT EXISTS substack_url TEXT;

COMMENT ON COLUMN bible_studies.substack_url IS 'Optional Substack URL for leader notes (e.g. Jason''s discussion notes). Shown on study card and guide pages when set.';

-- Optional: set Jason's study to use his Substack (run if you have a study with leader = 'jason'):
-- UPDATE bible_studies SET substack_url = 'https://jasondavidsnyder.substack.com' WHERE leader = 'jason';
