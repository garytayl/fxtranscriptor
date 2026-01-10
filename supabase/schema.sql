-- FX Transcriptor Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sermons table - Main catalog of all sermons
CREATE TABLE IF NOT EXISTS sermons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  podbean_url TEXT,
  youtube_url TEXT,
  youtube_video_id TEXT,
  audio_url TEXT,
  transcript TEXT,
  transcript_source TEXT CHECK (transcript_source IN ('youtube', 'podbean', 'apple', 'generated')),
  transcript_generated_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sermon sources table - Track where each sermon came from for deduplication
CREATE TABLE IF NOT EXISTS sermon_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sermon_id UUID NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('podbean', 'youtube')),
  source_url TEXT NOT NULL,
  source_id TEXT NOT NULL, -- episode ID or video ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_type, source_id) -- Prevent duplicate sources
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sermons_date ON sermons(date DESC);
CREATE INDEX IF NOT EXISTS idx_sermons_status ON sermons(status);
CREATE INDEX IF NOT EXISTS idx_sermons_youtube_video_id ON sermons(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_sermon_sources_sermon_id ON sermon_sources(sermon_id);
CREATE INDEX IF NOT EXISTS idx_sermon_sources_type_id ON sermon_sources(source_type, source_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_sermons_updated_at BEFORE UPDATE ON sermons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Make all sermons publicly readable
ALTER TABLE sermons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sermon_sources ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read sermons
CREATE POLICY "Sermons are viewable by everyone" ON sermons
    FOR SELECT USING (true);

-- Policy: Only authenticated users (or service role) can insert/update sermons
-- For now, we'll allow public inserts for the sync service
-- You can restrict this later if needed
CREATE POLICY "Sermons can be created by anyone" ON sermons
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Sermons can be updated by anyone" ON sermons
    FOR UPDATE USING (true);

-- Same policies for sermon_sources
CREATE POLICY "Sermon sources are viewable by everyone" ON sermon_sources
    FOR SELECT USING (true);

CREATE POLICY "Sermon sources can be created by anyone" ON sermon_sources
    FOR INSERT WITH CHECK (true);
