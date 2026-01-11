-- Add progress_json field to sermons table for tracking transcription progress
-- Run this in your Supabase SQL Editor

ALTER TABLE sermons ADD COLUMN IF NOT EXISTS progress_json JSONB;

-- Add comment to document the structure
COMMENT ON COLUMN sermons.progress_json IS 'Stores transcription progress as JSON: { step: string, current?: number, total?: number, message?: string, details?: string[] }';
