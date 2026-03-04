-- Add leader column to bible_studies for Mat's vs Jason's study tracks
-- Run in Supabase SQL Editor (or as migration). Idempotent.

ALTER TABLE bible_studies ADD COLUMN IF NOT EXISTS leader TEXT;

COMMENT ON COLUMN bible_studies.leader IS 'Study track: ''mat'' or ''jason''. Used to show two study cards on the studies page.';

-- Set current re:group study (Galatians) as Mat's so it appears in the first card
UPDATE bible_studies SET leader = 'mat' WHERE slug = 'galatians-2026' AND (leader IS NULL OR leader = '');
