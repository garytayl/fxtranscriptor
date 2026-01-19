-- Migration: Add series override + tighten sermon RLS
-- Run this in your Supabase SQL Editor

-- Add series override column
ALTER TABLE sermons
ADD COLUMN IF NOT EXISTS series_override TEXT;

-- Index for series override
CREATE INDEX IF NOT EXISTS idx_sermons_series_override ON sermons(series_override);

-- Tighten RLS policies for sermons
DROP POLICY IF EXISTS "Sermons can be created by anyone" ON sermons;
DROP POLICY IF EXISTS "Sermons can be updated by anyone" ON sermons;

CREATE POLICY "Sermons can be created by admins" ON sermons
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Sermons can be updated by admins" ON sermons
  FOR UPDATE USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Tighten RLS policies for sermon_sources
DROP POLICY IF EXISTS "Sermon sources can be created by anyone" ON sermon_sources;

CREATE POLICY "Sermon sources can be created by admins" ON sermon_sources
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Sermon sources can be updated by admins" ON sermon_sources
  FOR UPDATE USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Sermon sources can be deleted by admins" ON sermon_sources
  FOR DELETE USING (public.is_admin(auth.uid()));

