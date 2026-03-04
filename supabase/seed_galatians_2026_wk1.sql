-- Seed: Galatians 2026 re:group study — Week 1 (Gospel & identity)
-- Run in Supabase SQL Editor. If RLS blocks inserts, run as service_role or add via Admin → Studies.

-- 1) Insert or update the series
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
  'galatians-2026',
  'Galatians 2026',
  '',
  '#Galatians #2026 — re:group study series.',
  'https://fxtalk.podbean.com/category/2501',
  'http://fxchur.ch/rgvault',
  ARRAY['Galatians', '2026'],
  2026,
  true,
  0
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  podcast_url = EXCLUDED.podcast_url,
  vault_url = EXCLUDED.vault_url,
  tags = EXCLUDED.tags,
  year = EXCLUDED.year,
  is_current = EXCLUDED.is_current,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Clear previous "current" so only this series is current
UPDATE bible_studies SET is_current = false WHERE slug != 'galatians-2026';

-- 2) Insert Week 1 study guide (content in dollar-quoted block to avoid escaping)
WITH study AS (
  SELECT id FROM bible_studies WHERE slug = 'galatians-2026' LIMIT 1
),
guide_content AS (
  SELECT $md$
### Series Summary

*#Galatians #2026*

---

### [**ANNOUNCEMENTS**](https://fxchurch.com/events)

## Starter

Tell about a time that you received some really good news just when you needed it?

## Pray

## Study Questions

*"Gospel" in Greek is εὐαγγέλιον (transliterated as euangelion), which translates literally to "good news" or "glad tidings". Derived from eu ("good") and angelia ("message" or "tidings"), it was used in the New Testament to describe the announcement of salvation through Jesus Christ* (Yahweh is Salvation the Messiah)*.* The word gospel is used 76 times in the New Testament. Galatians uses the word gospel more than any other new testament book.

### **READ: [Galatians 1](https://www.stepbible.org/?q=version=HCSB@reference=Gal.1&options=NHVUG)**

**READ: [Galatians 1:1-3, 1 Corinthians 15:9-10, 14-19](https://www.stepbible.org/?q=version=HCSB@reference=1Cor.15.9-1Cor.15.10%201Cor.15.14-1Cor.15.19%20Gal.1.1-Gal.1.3&options=NHVUG)**

1. What can we learn about Paul from these verses?
    1. What can we learn about the gospel message?
2. Why is often very important to start with the gospel and our identity as believers in relationship conversations like Paul does in this letter?
    1. What can often happen if we don't?
3. The words grace and peace are often used in New Testament letter greetings. Why?
    1. How are grace and peace irrevocably linked?
4. Often, we think of the gospel and grace as the thing that saves us, but it is much more. Grace is charis χάρις meaning unmerited favor. We don't earn it. It is simply given as we respond in faith to God. Look at some of the things God says about grace!
- Jesus Christ is the embodiment (Jn 1:14)
- Saves us (Eph 2:8)
- The essence of the gospel (Acts 20:24)
- Gives victory over sin (Jam 4:6)
- The basis of calling (Rom 15:15; 1 Cor 3:10; Eph 3:2, 7)
- A gift…that must be received not earned (Eph 2:8-9)
- Justifies before a holy God (Rom 3:24; Eph 1:6; Titus 3:7)
- Provides access to God (Eph 1:6; Heb 4:16)
- Wins a new relationship of intimacy with God (Ex 33:17)
- Disciplines & trains to honor God (Ti 2:11–14; 2 Cor 8:7)
- Grants immeasurable spiritual riches (Pr 10:22; Eph 2:7)
- Helps in every need (Heb 4:16)
- Behind every deliverance (Ps 44:3–8; Heb 4:16)
- Preserves, comforts, encourages, strengthens
(2 Cor 13:14; 2 Thes 2:16–17; 2 Tim 2:1)
- Does not stop, continually working in believers
(1 Cor 15:10, John 15:5, 1 Tim 1:14)
- Causes and strengths us to surrender and serve
(Rom 12:6, Eph 3:2,7, 4:7, 1 Pt 4:10, 2 Cor 8:9)
    1. Which one of the above things about grace have you not thought about much?
    2. Which one is the most encouraging to you right now?

**READ: [Galatians 1:4-5, John 3:17-18](https://www.stepbible.org/?q=version=HCSB@reference=John.3.17-John.3.18%20Gal.1.4-Gal.1.5&options=NHVUG)**

1. What do we learn about the gospel message from these verses?

**READ: [Galatians 1:6-10](https://www.stepbible.org/?q=version=HCSB@reference=Gal.1.6-Gal.1.10&options=NHVUG)**

1. Most of the popular false gospels are based on a model of PRAGMATIC-MORAL-THERAPEUTIC-DIESM. What are some of the most popular false gospel messages?
2. As believers today, we often do not take seriously Paul's warning about being cursed for preaching a false gospel by adding or taking away from the gospel. Why?
3. The original sin of man in the garden of Eden was perpetrated on the question, *"Did God really say…?"* This question was asked to someone that may not have ever heard God directly say it, and that person added to what God said eventually bringing a curse. (Genesis 3)
    1. What are some of the popular things churches add or exclude from the gospel message today?
    2. Why won't we confront them if they might be cursed?!

**READ: [Matthew 6:24-25, Luke 6:26, John 12:43, 2 Timothy 4:3-4](https://www.stepbible.org/?q=version=HCSB@reference=Matt.6.24-Matt.6.25%20Luke.6.26%20John.12.43%202Tim.4.3-2Tim.4.4&options=NHVUG)**

1. What common reason for turning to a false gospel are warned against in these verses and Galatians 1:10?"
    1. How have you seen this specific reason play out either overtly or subtly in your relationships?

**READ: [1 Corinthians 9:19-23, 2 Corinthians 4:5](https://www.stepbible.org/?q=version=HCSB@reference=1Cor.9.19-1Cor.9.23%202Cor.4.5&options=NHVUG)**

1. Paul, while writing about grace and freedom, says very specifically in Galatians 1:10, 1 Corinthians 9:19-33, and 2 Corinthians 4:5 that he is a slave of Christ and a slave to the people of the church. Why don't we think that way or use that kind of language anymore?

**READ: [Galatians 1:11-12, 2 Timothy 3:16-17](https://www.stepbible.org/?q=version=HCSB@reference=Gal.1.11-Gal.1.12%202Tim.3.16-2Tim.3.17&options=NHVUG)**

1. What is Paul's message based on?
    1. How can we test whether the message he says he was given was a revelation from God?

**READ: [Acts 7:58, 8:1, 9:14-16, 20-23, 26-29, Acts 18:2-3, Galatians 1:13-21, Philippians 3:4-8](https://www.stepbible.org/?q=version=HCSB@reference=Acts.7.58%20Acts.8.1%20Acts.9.14-Acts.9.16%20Acts.9.20-Acts.9.23%20Acts.9.26-Acts.9.29%20Acts.18.2-Acts.18.3%20Gal.1.13-Gal.1.21%20Phil.3.4-Phil.3.8&options=NHVUG)**

1. What can we learn about Paul from these verses before he surrendered his life to Jesus?
    1. What can we learn about Paul from these verses after His conversion?
    2. How should his testimony about the gospel challenge and encourage us like he wanted it to challenge and encourage the Galatian church?
2. Before he was converted, Paul (Saul), as a so called believer in Yahweh, had legal authority, religious authority, and even thought he had biblical authority from the Scriptures ([Deuteronomy 13:5, 18:20](https://www.stepbible.org/?q=version=HCSB@reference=Deut.13.5%20Deut.18.20&options=NHVUG)) to punish and kill. How should this serve as a warning to you and I?
3. Paul took of the worldly credentials and put on the credentials of the gospel. Why do people so often chase the credentials of this world instead of a simple faithfully lived life in the gospel?
4. How is the gospel message we are called to share similar to what Ananias had to tell Paul, "*I will show him how much he must suffer for My name!*"?
    1. Why don't we like to think about it that message or share it?
5. From the point of Paul's conversion to living out his call and his first missionary journey, it was 10-12 years. He went from popularity, power, influence, wealth, and freedom to travel to just living in a place, working a trade, sharing the gospel, and being in a local church. How should this encourage us?
6. How is Paul's response to his conversion and calling often different from the way the modern church encourages people to respond after their conversion and a calling? Why?
7. Why is it so important for the gospel message that Paul lay out his testimony and calling clearly even naming names, dates, and times?

**READ: [Galatians 1:22-23](https://www.stepbible.org/?q=version=HCSB@reference=Gal.1.22-Gal.1.23&options=NHVUG)**

1. Have you ever used someone else's testimony to share the gospel like the churches were using Paul's? explain
2. How are Galatians 1:22-23 the simple message of the gospel we should long for in our lives and the lives of others?
    1. How do we get to the place where people are using our testimony and saying this about us because of the gospel? (hint: What did Paul do?)

### **FOLLOW UP**

- Do you believe that God sent the gospel message to you through the Lord Jesus Christ and His grace? Have you surrendered your life to Him? Why not?
- Is there something that you have allowed to be in your mind, heart, or life that could be setting up a false gospel? What will you do to find out and change it?
- Is there an area of your life that you are struggling to believe the gospel and the grace and peace of God?
- Is there anyone that we can pray for that you are not sure has surrendered to the gospel and experienced the grace and peace of Christ?
- Is their anyone in your immediate sphere of relationships that needs to hear the gospel from you this week? Will you at least pray for boldness?

## Prayer and Praises

Share praises and requests.

---

## Additional Notes

*Do you want to love God and others? In addition to going to church and re:group, communicate with God and others during the week. Text, email, call, write, and meet with people. Focus on gratitude. Say, "I'm grateful to God for you, and here's why." Tell God and others about your brokenness, hope in Jesus, and the commitments you have made leading to transformation. You'll find that the more obedient and grateful you are to God and the people He has placed in your life, the more you will grow and help others grow.*

## Leader Notes

*Remember silence is not bad. There are people who will never speak if the "speakers" constantly interrupt the silence. You may have to tell your group that :) Some of these questions are designed to move through quickly others are designed to move more slowly. It is about people engaging not getting all the answers or questions. Honor other peoples' time and end group ON TIME even if you don't get through all the questions. Also, remember that it is ok to say I don't know, but I will try to find out.*

## re:group Reminder

*At fxchurch, we desire to be a humble and confessional people by modeling it ourselves first. Re:groups are not a place to come to fix others but are a place to GO KNO SHO GRO in relationship to God and others. Our desire is to help people be led in a spirit of grace and truth. We will not condone sinful, selfish, or self righteous hearts and behavior. We will practice patience with others as they discover and are changed in heart and behavior. Anything that is said in the group should not be shared outside the group (unless seeking the counsel of a church leader) so gossip among group members should not take place. Above all else, have fun as you GO KNO SHO GRO.*

---

Listen to the [series podcast](https://fxtalk.podbean.com/category/2501) or browse the fxpress [re:group vault](http://fxchur.ch/rgvault).
$md$ AS c
)
INSERT INTO study_guides (
  study_id,
  slug,
  label,
  notion_url,
  default_passage_ref,
  content_md,
  sort_order
)
SELECT
  study.id,
  'wk-1',
  'Week 1',
  '',
  'Galatians 1',
  guide_content.c,
  0
FROM study, guide_content
ON CONFLICT (study_id, slug) DO UPDATE SET
  label = EXCLUDED.label,
  default_passage_ref = EXCLUDED.default_passage_ref,
  content_md = EXCLUDED.content_md,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
