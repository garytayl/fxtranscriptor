-- Seed: Jesus in the Feasts of Israel (Men's Breakfast — Wednesday mornings)
-- Run in Supabase SQL Editor.
--
-- If you get "relation bible_studies does not exist":
--   1. Run supabase/migration_add_bible_studies.sql first (creates bible_studies + study_guides).
--   2. Run supabase/migration_add_bible_studies_leader.sql (adds leader column).
--   3. Then run this file again.
--
-- If RLS blocks inserts, run as service_role or add the study via Admin → Studies.

-- 1) Insert the Feasts study (no leader = shows under "Other studies")
-- If your table has a "leader" column, you can add: , leader NULL
INSERT INTO bible_studies (
  slug,
  title,
  notion_url,
  summary,
  podcast_url,
  vault_url,
  tags,
  year,
  is_current,
  sort_order
) VALUES (
  'feasts-of-israel',
  'Jesus in the Feasts of Israel',
  '',
  'Men''s Breakfast — Wednesday mornings. The seven feasts of Israel (Passover, Unleavened Bread, Firstfruits, Pentecost, Trumpets, Day of Atonement, Tabernacles) and how they reveal the work of the Messiah.',
  NULL,
  NULL,
  ARRAY['mens-breakfast', 'feasts', 'old-testament'],
  2026,
  false,
  1
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  tags = EXCLUDED.tags,
  year = EXCLUDED.year,
  is_current = EXCLUDED.is_current,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- 2) Insert 8 study guides (intro + 7 feasts)
-- Guide 1: Introduction
WITH study AS (SELECT id FROM bible_studies WHERE slug = 'feasts-of-israel' LIMIT 1),
c1 AS (SELECT $md$
# An Introduction to the Feasts of Israel

The feasts of Israel are religious celebrations remembering God's great acts of salvation in the history of His people. The term "feasts" in Hebrew literally means "appointed times" and in Scripture the feasts often are called "holy convocations." They are times God has appointed for holy purposes – times in which the Lord meets with men and women.

While there are many religious celebrations in Jewish history and custom, **seven are most significant**: Passover, Unleavened Bread, Firstfruits, Pentecost, Trumpets, Day of Atonement, and Tabernacles. God established the timing and sequence of these feasts to reveal to us a special story – most significantly, the work of the Messiah in the redemption of mankind and the establishment of His Kingdom on earth.

## Why seven feasts?

The number seven is significant in Scripture. It is tied to completeness or fullness. God rested on the seventh day after creation; the cycle of the seven-day week provided the basis for much of Israel's worship. The seventh month features four of the seven feasts; the seventh year and the 50th year (Jubilee) are also significant.

## Key truths

- The Lord established the feasts and gave them to Israel.
- The feasts were based on the Jewish lunar calendar (12 months of 29 or 30 days per month).
- They picture the timing, sequence and significance of the Messiah's redemptive work.
- Though the feasts were given to Israel, every person is invited to meet with God through a personal relationship with Jesus Christ.
- All seven feasts are found in Leviticus 23.

## Why study the feasts?

1. To remember God's goodness  
2. To understand more fully His divine revelation through "types"  
3. To increase our knowledge of God's plan through the work of His eternal Son  
4. To more fully appreciate the work of Jesus Christ on our behalf  
5. To joyfully anticipate the days when Jesus will return and establish His Kingdom on earth.

*Copyright 2008 by Rob Phillips*
$md$ AS c)
INSERT INTO study_guides (study_id, slug, label, notion_url, default_passage_ref, content_md, sort_order)
SELECT study.id, 'intro', 'An Introduction to the Feasts of Israel', '', 'Leviticus 23', c1.c, 0
FROM study, c1
ON CONFLICT (study_id, slug) DO UPDATE SET label = EXCLUDED.label, default_passage_ref = EXCLUDED.default_passage_ref, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- Guide 2: Passover
WITH study AS (SELECT id FROM bible_studies WHERE slug = 'feasts-of-israel' LIMIT 1),
c2 AS (SELECT $md$
# The Feast of Passover (Pesach)

**Scriptures:** Ex. 12:1-28, 43-49; Lev. 23:5; Num. 28:16; Deut. 16:1-8  
**Time:** 14th day of Nisan (March/April)  
**Purpose:** To commemorate Israel's deliverance from Egyptian bondage.  
**Fulfillment:** Redemption – Christ's death as our Passover Lamb (John 1:29; 1 Cor. 5:7; 1 Peter 1:18-19).

## Background

Passover is the oldest continuously observed feast in existence today. There was only one Passover, 3,500 years ago in Egypt, when the angel of death passed over the homes of believing Jews who sacrificed a spotless lamb and sprinkled its blood on their doorposts. In the same way, there was only one occasion when the Messiah's body was pierced and His blood poured out for our sins. Jesus instituted the Lord's Supper during the feast of Passover.

## The Biblical Observance (Exodus 12)

Three symbolic foods: the **lamb** (perfect, consumed – picturing the sinless Messiah consumed by God's judgment for our sins); **matzah** – unleavened bread, punctured and scored (Christ's body, no sin, pierced for us); **bitter herbs** (hardship of captivity and suffering of the lamb).

## Fulfillment

Jesus is the Lamb of God who takes away the sin of the world (John 1:29; 1 Cor. 5:7; 1 Peter 1:18-19). He instituted the Lord's Supper during the feast of Passover.

*Copyright 2008 by Rob Phillips*
$md$ AS c)
INSERT INTO study_guides (study_id, slug, label, notion_url, default_passage_ref, content_md, sort_order)
SELECT study.id, 'passover', 'The Feast of Passover', '', 'Exodus 12', c2.c, 1 FROM study, c2
ON CONFLICT (study_id, slug) DO UPDATE SET label = EXCLUDED.label, default_passage_ref = EXCLUDED.default_passage_ref, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- Guide 3: Unleavened Bread
WITH study AS (SELECT id FROM bible_studies WHERE slug = 'feasts-of-israel' LIMIT 1),
c3 AS (SELECT $md$
# The Feast of Unleavened Bread (Hag HaMatzah)

**Scriptures:** Ex. 12:15-20, 13:3-10; Lev. 23:6-8; Num. 28:17-25; Deut. 16:3-8  
**Time:** 15th day of Nisan, seven days (March/April)  
**Purpose:** To commemorate the hardships of Israel's escape from Egypt.  
**Fulfillment:** Sanctification – Christ's burial; His body did not suffer decay (John 6:30-59; 1 Cor. 11:24).

Leaven pictures sin in the Bible. Unleavened bread pictures Jesus: without leaven (without sin), striped and pierced. The feast symbolizes Jesus' burial – His body in the grave did not see corruption; He rose on the third day and carried our sins away.

*Copyright 2008 by Rob Phillips*
$md$ AS c)
INSERT INTO study_guides (study_id, slug, label, notion_url, default_passage_ref, content_md, sort_order)
SELECT study.id, 'unleavened-bread', 'The Feast of Unleavened Bread', '', NULL, c3.c, 2 FROM study, c3
ON CONFLICT (study_id, slug) DO UPDATE SET label = EXCLUDED.label, default_passage_ref = EXCLUDED.default_passage_ref, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- Guide 4: Firstfruits
WITH study AS (SELECT id FROM bible_studies WHERE slug = 'feasts-of-israel' LIMIT 1),
c4 AS (SELECT $md$
# The Feast of Firstfruits (Yom Habikkurim)

**Scriptures:** Lev. 23:9-14  
**Time:** 16th day of Nisan (March/April)  
**Purpose:** To dedicate the firstfruits of the barley harvest.  
**Fulfillment:** Resurrection – Christ's bodily resurrection (1 Cor. 15:20-23).

Jesus rose from the dead on the third day of Passover season (Nisan 16), on the day of Firstfruits – completing the picture: death (Passover), burial (Unleavened Bread), resurrection (Firstfruits). Christ is the firstfruits of those who have fallen asleep.

*Copyright 2008 by Rob Phillips*
$md$ AS c)
INSERT INTO study_guides (study_id, slug, label, notion_url, default_passage_ref, content_md, sort_order)
SELECT study.id, 'firstfruits', 'The Feast of Firstfruits', '', NULL, c4.c, 3 FROM study, c4
ON CONFLICT (study_id, slug) DO UPDATE SET label = EXCLUDED.label, default_passage_ref = EXCLUDED.default_passage_ref, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- Guide 5: Pentecost
WITH study AS (SELECT id FROM bible_studies WHERE slug = 'feasts-of-israel' LIMIT 1),
c5 AS (SELECT $md$
# The Feast of Pentecost (Shavuot)

**Scriptures:** Lev. 23:15-22; Num. 28:26-31; Deut. 16:9-12  
**Time:** 50 days after Firstfruits (May/June)  
**Purpose:** To dedicate the firstfruits of the wheat harvest.  
**Fulfillment:** The outpouring of the Holy Spirit and the birthday of the church (Acts 2).

The Spirit came on the Day of Pentecost as Jews from all over the world gathered in Israel. The two loaves with leaven at Shavuot symbolize the Body of Christ (Jews and Gentiles) – the church. The 3,000 saved on the Day of Pentecost were the firstfruits of the church.

*Copyright 2008 by Rob Phillips*
$md$ AS c)
INSERT INTO study_guides (study_id, slug, label, notion_url, default_passage_ref, content_md, sort_order)
SELECT study.id, 'pentecost', 'The Feast of Pentecost (Shavuot)', '', 'Acts 2', c5.c, 4 FROM study, c5
ON CONFLICT (study_id, slug) DO UPDATE SET label = EXCLUDED.label, default_passage_ref = EXCLUDED.default_passage_ref, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- Guide 6: Trumpets
WITH study AS (SELECT id FROM bible_studies WHERE slug = 'feasts-of-israel' LIMIT 1),
c6 AS (SELECT $md$
# The Feast of Trumpets (Rosh Hashanah)

**Scriptures:** Lev. 23:23-25; Num. 10:10, 29:1-6  
**Time:** 1st day of Tishri (September/October)  
**Purpose:** To usher in the seventh month and begin "The Days of Awe."  
**Fulfillment:** The rapture of the church (1 Cor. 15:51-52; 1 Thess. 4:16-17).

The trumpet will sound, and the dead in Christ will rise first; then we who are alive will be caught up together with them to meet the Lord in the air. The spring feasts were fulfilled at Christ's first coming; the fall festivals (Trumpets, Atonement, Tabernacles) will be fulfilled at His second coming.

*Copyright 2008 by Rob Phillips*
$md$ AS c)
INSERT INTO study_guides (study_id, slug, label, notion_url, default_passage_ref, content_md, sort_order)
SELECT study.id, 'trumpets', 'The Feast of Trumpets (Rosh Hashanah)', '', NULL, c6.c, 5 FROM study, c6
ON CONFLICT (study_id, slug) DO UPDATE SET label = EXCLUDED.label, default_passage_ref = EXCLUDED.default_passage_ref, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- Guide 7: Day of Atonement
WITH study AS (SELECT id FROM bible_studies WHERE slug = 'feasts-of-israel' LIMIT 1),
c7 AS (SELECT $md$
# The Day of Atonement (Yom Kippur)

**Scriptures:** Lev. 23:26-32; Num. 29:7-11  
**Time:** 10th day of Tishri (September/October)  
**Purpose:** To make annual atonement for sins.  
**Fulfillment:** The crucifixion and Israel's repentance at the return of Christ (Zech. 12:10).

Yom Kippur is Israel's most solemn holy day. The high priest entered the Holy of Holies with the blood of sacrifices. Jesus, our great high priest, offered His own blood once and for all – the veil was torn (Matt. 27:51). His death took away sin; the blood of bulls and goats could only cover it. The Year of Jubilee was proclaimed on the Day of Atonement – a picture of Christ's cancellation of our sin debt and the rest He gives.

*Copyright 2008 by Rob Phillips*
$md$ AS c)
INSERT INTO study_guides (study_id, slug, label, notion_url, default_passage_ref, content_md, sort_order)
SELECT study.id, 'day-of-atonement', 'The Day of Atonement (Yom Kippur)', '', 'Leviticus 16', c7.c, 6 FROM study, c7
ON CONFLICT (study_id, slug) DO UPDATE SET label = EXCLUDED.label, default_passage_ref = EXCLUDED.default_passage_ref, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- Guide 8: Tabernacles
WITH study AS (SELECT id FROM bible_studies WHERE slug = 'feasts-of-israel' LIMIT 1),
c8 AS (SELECT $md$
# The Feast of Tabernacles (Sukkot)

**Scriptures:** Lev. 23:33-43; Num. 29:12-39; Deut. 16:13-17, 31:10-13  
**Time:** 15th–21st of Tishri, with an 8th day (September/October)  
**Purpose:** To commemorate God's protection during the wilderness wanderings and to rejoice in the harvest.  
**Fulfillment:** Restoration – the peace and prosperity of God's Kingdom on earth.

The seventh and final feast. God's people will be gathered; the Lord will tabernacle with the redeemed (Rev. 21:3). John 1:14: "The Word became flesh and tabernacled among us." When the Messiah returns, He will bring Jew and Gentile to worship in Jerusalem (Zech. 14:16-17). "Amen. Come, Lord Jesus!" (Rev. 22:20).

*Copyright 2008 by Rob Phillips*
$md$ AS c)
INSERT INTO study_guides (study_id, slug, label, notion_url, default_passage_ref, content_md, sort_order)
SELECT study.id, 'tabernacles', 'The Feast of Tabernacles (Sukkot)', '', NULL, c8.c, 7 FROM study, c8
ON CONFLICT (study_id, slug) DO UPDATE SET label = EXCLUDED.label, default_passage_ref = EXCLUDED.default_passage_ref, content_md = EXCLUDED.content_md, sort_order = EXCLUDED.sort_order, updated_at = NOW();
