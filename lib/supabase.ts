/**
 * Supabase Client Setup
 * 
 * To set up:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Get your project URL and anon key from Settings > API
 * 3. Add them to .env.local (see .env.local.example)
 * 4. Run the schema.sql file in your Supabase SQL Editor
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mfzrunlgkpbtiwuzmivq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1menJ1bmxna3BidGl3dXptaXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzExOTcsImV4cCI6MjA4MzY0NzE5N30.0t5wve3InEVRGev5i_FwTohcxvZ_rmo4QwWTULv5RSc';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are not set. ' +
    'Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Database types
export interface Sermon {
  id: string;
  title: string;
  date: string | null;
  description: string | null;
  podbean_url: string | null;
  youtube_url: string | null;
  youtube_video_id: string | null;
  audio_url: string | null;
  transcript: string | null;
  transcript_source: 'youtube' | 'podbean' | 'apple' | 'generated' | null;
  transcript_generated_at: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message: string | null;
  progress_json: { 
    step: string; 
    current?: number; 
    total?: number; 
    message?: string; 
    details?: string[];
    completedChunks?: Record<number, string>; // Chunk index -> transcript text
    failedChunks?: Record<number, string>; // Chunk index -> error message
  } | null;
  created_at: string;
  updated_at: string;
}

export interface SermonSource {
  id: string;
  sermon_id: string;
  source_type: 'podbean' | 'youtube';
  source_url: string;
  source_id: string;
  created_at: string;
}
