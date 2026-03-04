-- Seed: Immigration topical study for Devotions
-- Run this in Supabase SQL Editor. If you get an RLS permission error, add the topic instead via Admin → Devotions.

INSERT INTO devotion_topics (
  title,
  slug,
  description,
  body,
  bible_references,
  sort_order,
  published,
  is_current,
  featured_at
) VALUES (
  'Immigration — What the Bible Says',
  'immigration',
  'What Scripture says about the stranger, the sojourner, and loving our neighbor.',
  E'## Overview\n\nScripture repeatedly calls God’s people to care for the foreigner and sojourner. This study highlights key passages and themes.\n\n## Key themes\n\n- **The sojourner in the Law** — Israel was commanded to love and not oppress the stranger (Exodus, Leviticus, Deuteronomy).\n- **Justice and mercy** — God identifies with the vulnerable; how we treat the stranger reflects our heart.\n- **The church as a new family** — In Christ there is no Jew nor Greek; we are one in him.\n\n## Reflection\n\nHow might your community extend hospitality and justice to immigrants and refugees?',
  ARRAY['Exodus 22:21', 'Leviticus 19:33-34', 'Deuteronomy 10:18-19', 'Matthew 25:35', 'Hebrews 13:2'],
  0,
  true,
  true,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  body = EXCLUDED.body,
  bible_references = EXCLUDED.bible_references,
  sort_order = EXCLUDED.sort_order,
  published = EXCLUDED.published,
  updated_at = NOW();
