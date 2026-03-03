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
  series TEXT,
  series_override TEXT,
  speaker TEXT,
  podbean_url TEXT,
  youtube_url TEXT,
  youtube_video_id TEXT,
  audio_url TEXT,
  transcript TEXT,
  transcript_source TEXT CHECK (transcript_source IN ('youtube', 'podbean', 'apple', 'generated')),
  transcript_generated_at TIMESTAMP WITH TIME ZONE,
  unified_summary_json JSONB,
  unified_summary_generated_at TIMESTAMP WITH TIME ZONE,
  unified_summary_model TEXT,
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
CREATE INDEX IF NOT EXISTS idx_sermons_series ON sermons(series);
CREATE INDEX IF NOT EXISTS idx_sermons_series_override ON sermons(series_override);
CREATE INDEX IF NOT EXISTS idx_sermons_speaker ON sermons(speaker);
CREATE INDEX IF NOT EXISTS idx_sermons_status ON sermons(status);
CREATE INDEX IF NOT EXISTS idx_sermons_youtube_video_id ON sermons(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_sermons_unified_summary_generated_at ON sermons(unified_summary_generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sermon_sources_sermon_id ON sermon_sources(sermon_id);
CREATE INDEX IF NOT EXISTS idx_sermon_sources_type_id ON sermon_sources(source_type, source_id);

-- Profiles table - Admin roles and access control
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_sermons_updated_at'
  ) THEN
    CREATE TRIGGER update_sermons_updated_at
      BEFORE UPDATE ON sermons
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Trigger to auto-update profiles.updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Admin check helper
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = $1
      AND profiles.role = 'admin'
  );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'member')
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Row Level Security (RLS) - Make all sermons publicly readable
ALTER TABLE sermons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sermon_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read sermons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sermons'
      AND policyname = 'Sermons are viewable by everyone'
  ) THEN
    CREATE POLICY "Sermons are viewable by everyone" ON sermons
      FOR SELECT USING (true);
  END IF;
END $$;

-- Policy: Only admins can insert/update sermons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sermons'
      AND policyname = 'Sermons can be created by admins'
  ) THEN
    CREATE POLICY "Sermons can be created by admins" ON sermons
      FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sermons'
      AND policyname = 'Sermons can be updated by admins'
  ) THEN
    CREATE POLICY "Sermons can be updated by admins" ON sermons
      FOR UPDATE USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- Same policies for sermon_sources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sermon_sources'
      AND policyname = 'Sermon sources are viewable by everyone'
  ) THEN
    CREATE POLICY "Sermon sources are viewable by everyone" ON sermon_sources
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sermon_sources'
      AND policyname = 'Sermon sources can be created by admins'
  ) THEN
    CREATE POLICY "Sermon sources can be created by admins" ON sermon_sources
      FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sermon_sources'
      AND policyname = 'Sermon sources can be updated by admins'
  ) THEN
    CREATE POLICY "Sermon sources can be updated by admins" ON sermon_sources
      FOR UPDATE USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sermon_sources'
      AND policyname = 'Sermon sources can be deleted by admins'
  ) THEN
    CREATE POLICY "Sermon sources can be deleted by admins" ON sermon_sources
      FOR DELETE USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- Profiles policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles are viewable by owner'
  ) THEN
    CREATE POLICY "Profiles are viewable by owner" ON profiles
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles can be updated by owner'
  ) THEN
    CREATE POLICY "Profiles can be updated by owner" ON profiles
      FOR UPDATE USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles are viewable by admins'
  ) THEN
    CREATE POLICY "Profiles are viewable by admins" ON profiles
      FOR SELECT USING (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles can be updated by admins'
  ) THEN
    CREATE POLICY "Profiles can be updated by admins" ON profiles
      FOR UPDATE USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- Devotion topics: weekly topical studies (e.g. Immigration — What the Bible Says)
CREATE TABLE IF NOT EXISTS devotion_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  body TEXT,
  bible_references TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  is_current BOOLEAN NOT NULL DEFAULT false,
  featured_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(slug)
);

-- Add columns for existing installs that ran the table without is_current/featured_at
ALTER TABLE devotion_topics ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE devotion_topics ADD COLUMN IF NOT EXISTS featured_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_devotion_topics_published_sort ON devotion_topics(published, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devotion_topics_is_current ON devotion_topics(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_devotion_topics_slug ON devotion_topics(slug);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_devotion_topics_updated_at'
  ) THEN
    CREATE TRIGGER update_devotion_topics_updated_at
      BEFORE UPDATE ON devotion_topics
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE devotion_topics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'devotion_topics' AND policyname = 'Devotion topics are viewable by everyone when published'
  ) THEN
    CREATE POLICY "Devotion topics are viewable by everyone when published" ON devotion_topics
      FOR SELECT USING (published = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'devotion_topics' AND policyname = 'Devotion topics are viewable by admins'
  ) THEN
    CREATE POLICY "Devotion topics are viewable by admins" ON devotion_topics
      FOR SELECT USING (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'devotion_topics' AND policyname = 'Devotion topics can be created by admins'
  ) THEN
    CREATE POLICY "Devotion topics can be created by admins" ON devotion_topics
      FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'devotion_topics' AND policyname = 'Devotion topics can be updated by admins'
  ) THEN
    CREATE POLICY "Devotion topics can be updated by admins" ON devotion_topics
      FOR UPDATE USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'devotion_topics' AND policyname = 'Devotion topics can be deleted by admins'
  ) THEN
    CREATE POLICY "Devotion topics can be deleted by admins" ON devotion_topics
      FOR DELETE USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- Bible verses: local scripture text (e.g. HCSB import). One row per verse.
CREATE TABLE IF NOT EXISTS bible_verses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  translation_slug TEXT NOT NULL,
  book_slug TEXT NOT NULL,
  chapter_number INT NOT NULL,
  verse_number INT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(translation_slug, book_slug, chapter_number, verse_number)
);

CREATE INDEX IF NOT EXISTS idx_bible_verses_lookup ON bible_verses(translation_slug, book_slug, chapter_number);
CREATE INDEX IF NOT EXISTS idx_bible_verses_progress ON bible_verses(translation_slug, book_slug);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bible_verses_updated_at') THEN
    CREATE TRIGGER update_bible_verses_updated_at
      BEFORE UPDATE ON bible_verses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE bible_verses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bible_verses' AND policyname = 'Bible verses are viewable by everyone') THEN
    CREATE POLICY "Bible verses are viewable by everyone" ON bible_verses FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bible_verses' AND policyname = 'Bible verses insert by admins') THEN
    CREATE POLICY "Bible verses insert by admins" ON bible_verses FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bible_verses' AND policyname = 'Bible verses update by admins') THEN
    CREATE POLICY "Bible verses update by admins" ON bible_verses FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bible_verses' AND policyname = 'Bible verses delete by admins') THEN
    CREATE POLICY "Bible verses delete by admins" ON bible_verses FOR DELETE USING (public.is_admin(auth.uid()));
  END IF;
END $$;
