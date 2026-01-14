-- Migration: Add unified sermon summary storage
-- Run this in your Supabase SQL Editor

-- Store the unified summary (sections array) on the sermon row
ALTER TABLE sermons
  ADD COLUMN IF NOT EXISTS unified_summary_json JSONB,
  ADD COLUMN IF NOT EXISTS unified_summary_generated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS unified_summary_model TEXT;

-- Optional index for existence checks / debugging (not strictly necessary)
CREATE INDEX IF NOT EXISTS idx_sermons_unified_summary_generated_at
  ON sermons(unified_summary_generated_at DESC);

