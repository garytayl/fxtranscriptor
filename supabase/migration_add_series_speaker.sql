-- Migration: Add series and speaker fields to sermons table
-- Run this in your Supabase SQL Editor

-- Add series and speaker columns
ALTER TABLE sermons 
ADD COLUMN IF NOT EXISTS series TEXT,
ADD COLUMN IF NOT EXISTS speaker TEXT;

-- Add index for series to improve query performance
CREATE INDEX IF NOT EXISTS idx_sermons_series ON sermons(series);

-- Add index for speaker to improve query performance
CREATE INDEX IF NOT EXISTS idx_sermons_speaker ON sermons(speaker);
