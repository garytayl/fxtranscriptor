-- Migration: Add chunk summaries and verses tables
-- Run this in your Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sermon chunk summaries table
CREATE TABLE IF NOT EXISTS sermon_chunk_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sermon_id UUID NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sermon_id, chunk_index) -- One summary per chunk per sermon
);

-- Sermon chunk verses table
CREATE TABLE IF NOT EXISTS sermon_chunk_verses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  summary_id UUID NOT NULL REFERENCES sermon_chunk_summaries(id) ON DELETE CASCADE,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse_start INTEGER NOT NULL,
  verse_end INTEGER, -- NULL for single verse, set for verse ranges
  full_reference TEXT NOT NULL, -- e.g., "John 3:16" or "Romans 8:28-30"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chunk_summaries_sermon_id ON sermon_chunk_summaries(sermon_id);
CREATE INDEX IF NOT EXISTS idx_chunk_summaries_chunk_index ON sermon_chunk_summaries(chunk_index);
CREATE INDEX IF NOT EXISTS idx_chunk_verses_summary_id ON sermon_chunk_verses(summary_id);
CREATE INDEX IF NOT EXISTS idx_chunk_verses_book_chapter ON sermon_chunk_verses(book, chapter);

-- Function to update updated_at timestamp for summaries
CREATE OR REPLACE FUNCTION update_chunk_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_chunk_summaries_updated_at ON sermon_chunk_summaries;
CREATE TRIGGER update_chunk_summaries_updated_at BEFORE UPDATE ON sermon_chunk_summaries
    FOR EACH ROW EXECUTE FUNCTION update_chunk_summaries_updated_at();

-- Row Level Security (RLS)
ALTER TABLE sermon_chunk_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sermon_chunk_verses ENABLE ROW LEVEL SECURITY;

-- Policies: Everyone can read summaries and verses
DROP POLICY IF EXISTS "Chunk summaries are viewable by everyone" ON sermon_chunk_summaries;
CREATE POLICY "Chunk summaries are viewable by everyone" ON sermon_chunk_summaries
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Chunk verses are viewable by everyone" ON sermon_chunk_verses;
CREATE POLICY "Chunk verses are viewable by everyone" ON sermon_chunk_verses
    FOR SELECT USING (true);

-- Policies: Anyone can insert/update/delete (for API routes)
DROP POLICY IF EXISTS "Chunk summaries can be created by anyone" ON sermon_chunk_summaries;
CREATE POLICY "Chunk summaries can be created by anyone" ON sermon_chunk_summaries
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Chunk summaries can be updated by anyone" ON sermon_chunk_summaries;
CREATE POLICY "Chunk summaries can be updated by anyone" ON sermon_chunk_summaries
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Chunk summaries can be deleted by anyone" ON sermon_chunk_summaries;
CREATE POLICY "Chunk summaries can be deleted by anyone" ON sermon_chunk_summaries
    FOR DELETE USING (true);

DROP POLICY IF EXISTS "Chunk verses can be created by anyone" ON sermon_chunk_verses;
CREATE POLICY "Chunk verses can be created by anyone" ON sermon_chunk_verses
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Chunk verses can be deleted by anyone" ON sermon_chunk_verses;
CREATE POLICY "Chunk verses can be deleted by anyone" ON sermon_chunk_verses
    FOR DELETE USING (true);
