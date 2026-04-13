# Morphology datasets (Greek / Hebrew)

## Summary

The app pilots **verse-aligned Greek morphology** using **MorphGNT** (Robinson-style parses) for bundled chapters (currently **John 1**, **Luke 6**). KJV **Strong’s** alignment is English word order; Greek morphology is keyed to **Greek word order** in the same verse, so the UI shows a separate Greek line (SBL Greek New Testament text via MorphGNT) rather than fusing parses onto KJV tokens.

## What happened

Strong’s-only word study answers “which lemma underlies this English word?” It does not encode tense, case, voice, or clause structure. Teaching grammar required a second data layer with **per-word parses**.

## Why MorphGNT

- **MorphGNT / SBLGNT** ([github.com/morphgnt/sblgnt](https://github.com/morphgnt/sblgnt)): open **morphological parsing and lemmatization** under **CC-BY-SA 3.0**; Greek text subject to **SBLGNT EULA** (attribution and use limits for large quotations).
- Data is **book/chapter/verse + ordered tokens**, which maps cleanly to a reader UI.
- **Hebrew (WLC + morphology)** from e.g. **Open Scriptures Hebrew Bible** ([github.com/openscriptures/morphhb](https://github.com/openscriptures/morphhb)) is a good next step; formats are often **OSIS XML**, requiring extraction and a **different parse vocabulary** (stems, states, etc.).

## How we use it

- `scripts/build-john1-morph.mjs` → `64-Jn-morphgnt.txt` → `lib/bible/morph-data/john-1.json` (BCV prefix `0401xx`).
- `scripts/build-luke-6-morph.mjs` → `63-Lk-morphgnt.txt` → `lib/bible/morph-data/luke-6.json` (BCV prefix `0306xx`).
- `lib/bible/morph-lookup.ts` registers pilot chapters in `MORPH_PILOT_CHAPTERS`.
- Alignment with **kaiserlik KJV Strong’s** is **by verse only**, not by English word index.

## How to avoid mistakes next time

- Do not assume **one** morph tag can attach to **KJV** word *i* without a **human or algorithmic alignment** table.
- When adding a chapter, run the MorphGNT pipeline script and append the file + `morph-lookup` entry rather than hand-editing tokens.
