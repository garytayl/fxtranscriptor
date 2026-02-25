-- Bible studies and study guides tables
-- Stores study metadata and weekly guide content (replaces hardcoded lib/studies.ts)

CREATE TABLE IF NOT EXISTS bible_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  notion_url TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  podcast_url TEXT,
  vault_url TEXT,
  tags TEXT[] DEFAULT '{}',
  year INTEGER,
  is_current BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES bible_studies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  notion_url TEXT NOT NULL DEFAULT '',
  default_passage_ref TEXT,
  content_md TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(study_id, slug)
);

-- RLS: public read, admin write
ALTER TABLE bible_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bible_studies_public_read" ON bible_studies FOR SELECT USING (true);
CREATE POLICY "bible_studies_admin_insert" ON bible_studies FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "bible_studies_admin_update" ON bible_studies FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "bible_studies_admin_delete" ON bible_studies FOR DELETE USING (is_admin(auth.uid()));

CREATE POLICY "study_guides_public_read" ON study_guides FOR SELECT USING (true);
CREATE POLICY "study_guides_admin_insert" ON study_guides FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "study_guides_admin_update" ON study_guides FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "study_guides_admin_delete" ON study_guides FOR DELETE USING (is_admin(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER bible_studies_updated_at BEFORE UPDATE ON bible_studies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER study_guides_updated_at BEFORE UPDATE ON study_guides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
