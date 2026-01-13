-- Add transcription queue table for managing global transcription queue
-- Only one sermon can be transcribed at a time across all users
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS transcription_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sermon_id UUID NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  position INTEGER NOT NULL, -- Position in queue (1 = next to process, 2 = second, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sermon_id) -- Prevent duplicate entries for same sermon
);

-- Index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_transcription_queue_status ON transcription_queue(status);
CREATE INDEX IF NOT EXISTS idx_transcription_queue_position ON transcription_queue(position);
CREATE INDEX IF NOT EXISTS idx_transcription_queue_sermon_id ON transcription_queue(sermon_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transcription_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_transcription_queue_updated_at BEFORE UPDATE ON transcription_queue
    FOR EACH ROW EXECUTE FUNCTION update_transcription_queue_updated_at();

-- Row Level Security (RLS) - Make queue publicly readable, but only service can modify
ALTER TABLE transcription_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read the queue
CREATE POLICY "Queue is viewable by everyone" ON transcription_queue
    FOR SELECT USING (true);

-- Policy: Anyone can insert (to add to queue)
CREATE POLICY "Queue can be added to by anyone" ON transcription_queue
    FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update (to cancel, etc.)
CREATE POLICY "Queue can be updated by anyone" ON transcription_queue
    FOR UPDATE USING (true);

-- Policy: Anyone can delete (for cleanup)
CREATE POLICY "Queue can be deleted by anyone" ON transcription_queue
    FOR DELETE USING (true);

-- Function to get next position in queue
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
DECLARE
  max_position INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), 0) INTO max_position FROM transcription_queue;
  RETURN max_position + 1;
END;
$$ LANGUAGE plpgsql;
