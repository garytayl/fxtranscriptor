/**
 * Curated passages for "passage of the day" — OT, NT, Psalms, Wisdom.
 * One per day by day-of-year; cycles so every day has a fixed passage.
 */

const PASSAGES: string[] = [
  "Genesis 1:1-5",
  "Psalm 1",
  "Matthew 5:1-12",
  "John 1:1-14",
  "Romans 8:28-39",
  "Isaiah 40:28-31",
  "Psalm 23",
  "Matthew 6:9-13",
  "John 3:16-21",
  "Philippians 4:4-9",
  "Psalm 27:1-6",
  "Proverbs 3:1-8",
  "Matthew 11:28-30",
  "John 14:1-7",
  "Romans 12:1-2",
  "Psalm 34:1-8",
  "Isaiah 53:4-6",
  "Matthew 28:18-20",
  "John 15:1-11",
  "Galatians 5:22-26",
  "Psalm 42:1-5",
  "Lamentations 3:22-26",
  "Luke 15:11-24",
  "John 17:20-26",
  "Ephesians 2:8-10",
  "Psalm 46:1-5",
  "Isaiah 55:6-9",
  "Matthew 22:36-40",
  "Acts 4:12",
  "Colossians 3:12-17",
  "Psalm 51:10-12",
  "Micah 6:6-8",
  "Matthew 25:34-40",
  "Romans 5:1-5",
  "Hebrews 11:1-3",
  "Psalm 63:1-5",
  "Isaiah 61:1-3",
  "Luke 6:27-36",
  "Romans 8:1-4",
  "James 1:2-5",
  "Psalm 91:1-6",
  "Psalm 103:1-5",
  "Matthew 6:25-34",
  "John 8:31-36",
  "1 Corinthians 13:4-8",
  "Psalm 119:105-112",
  "Isaiah 43:1-4",
  "Mark 1:35-39",
  "John 10:27-30",
  "2 Corinthians 4:16-18",
  "Psalm 121",
  "Psalm 139:1-6",
  "Matthew 7:7-11",
  "Luke 18:9-14",
  "Romans 12:9-13",
  "Psalm 145:8-13",
  "Proverbs 16:3",
  "Matthew 5:14-16",
  "John 13:34-35",
  "1 John 4:7-12",
  "Psalm 19:1-6",
  "Isaiah 26:3-4",
  "Matthew 6:1-6",
  "Luke 10:38-42",
  "1 Peter 5:6-7",
  "Psalm 27:14",
  "Joshua 1:8-9",
  "Matthew 16:24-26",
  "John 16:33",
  "Revelation 21:3-5",
  "Psalm 34:18-19",
  "Isaiah 41:10",
  "Matthew 18:19-20",
  "Acts 2:38-39",
  "Hebrews 12:1-2",
  "Psalm 46:10",
  "Psalm 90:12-17",
  "Matthew 28:1-10",
  "Romans 6:3-5",
  "1 John 1:8-9",
  "Psalm 118:24",
  "Psalm 136:1-9",
  "Isaiah 9:2-7",
  "Luke 2:8-14",
  "2 Corinthians 5:17",
  "Psalm 150",
]

export const DEVOTIONS_PASSAGES_COUNT = PASSAGES.length

/** Day of year 1–366. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 864e5
  return Math.floor(diff / oneDay)
}

/** Passage reference for a given date. Same date always returns the same passage. */
export function getPassageRefForDate(date: Date): string {
  const day = dayOfYear(date)
  const index = (day - 1) % PASSAGES.length
  return PASSAGES[index] ?? PASSAGES[0]
}

/** All passages (for picker if we add one). */
export function getAllPassageRefs(): string[] {
  return [...PASSAGES]
}

// ——— Landing hero: verse + subtitle, rotated by day (50 combos) ———

export type LandingCombo = { verse: string; reference: string; subtitle: string }

const LANDING_COMBOS: LandingCombo[] = [
  { verse: "Be still, and know that I am God.", reference: "Psalm 46:10", subtitle: "Find the stillness. He is the Lord." },
  { verse: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1", subtitle: "Rest in his care today." },
  { verse: "Come to me, all who labor and are heavy laden, and I will give you rest.", reference: "Matthew 11:28", subtitle: "His yoke is easy; his burden is light." },
  { verse: "Trust in the Lord with all your heart.", reference: "Proverbs 3:5", subtitle: "Lean not on your own understanding." },
  { verse: "The Lord is near to the brokenhearted.", reference: "Psalm 34:18", subtitle: "He saves the crushed in spirit." },
  { verse: "In the beginning was the Word.", reference: "John 1:1", subtitle: "The Word was with God and was God." },
  { verse: "For God so loved the world.", reference: "John 3:16", subtitle: "That he gave his only Son." },
  { verse: "The Lord is my light and my salvation.", reference: "Psalm 27:1", subtitle: "Whom shall I fear?" },
  { verse: "Peace I leave with you; my peace I give to you.", reference: "John 14:27", subtitle: "Not as the world gives." },
  { verse: "Rejoice in the Lord always.", reference: "Philippians 4:4", subtitle: "Again I will say, rejoice." },
  { verse: "Be strong and courageous. Do not be frightened.", reference: "Joshua 1:9", subtitle: "The Lord your God is with you." },
  { verse: "The steadfast love of the Lord never ceases.", reference: "Lamentations 3:22", subtitle: "His mercies never come to an end." },
  { verse: "I have said these things to you, that in me you may have peace.", reference: "John 16:33", subtitle: "In the world you will have tribulation. But take heart." },
  { verse: "Cast all your anxiety on him, because he cares for you.", reference: "1 Peter 5:7", subtitle: "Humble yourselves under his hand." },
  { verse: "Your word is a lamp to my feet.", reference: "Psalm 119:105", subtitle: "And a light to my path." },
  { verse: "Wait for the Lord; be strong, and let your heart take courage.", reference: "Psalm 27:14", subtitle: "Wait for the Lord." },
  { verse: "Fear not, for I am with you.", reference: "Isaiah 41:10", subtitle: "Be not dismayed, for I am your God." },
  { verse: "Love one another, as I have loved you.", reference: "John 13:34", subtitle: "By this all people will know." },
  { verse: "The Lord is gracious and merciful.", reference: "Psalm 145:8", subtitle: "Slow to anger and abounding in steadfast love." },
  { verse: "Commit your work to the Lord.", reference: "Proverbs 16:3", subtitle: "And your plans will be established." },
  { verse: "He has told you, O man, what is good.", reference: "Micah 6:8", subtitle: "Do justice, love kindness, walk humbly." },
  { verse: "Jesus Christ is the same yesterday and today and forever.", reference: "Hebrews 13:8", subtitle: "Anchor your soul in him." },
  { verse: "The Lord will fight for you; you need only be still.", reference: "Exodus 14:14", subtitle: "Stand firm and see his salvation." },
  { verse: "Seek first the kingdom of God.", reference: "Matthew 6:33", subtitle: "And all these things will be added to you." },
  { verse: "Abide in me, and I in you.", reference: "John 15:4", subtitle: "As the branch cannot bear fruit by itself." },
  { verse: "This is the day that the Lord has made.", reference: "Psalm 118:24", subtitle: "Let us rejoice and be glad in it." },
  { verse: "The Lord is my portion.", reference: "Lamentations 3:24", subtitle: "Therefore I will hope in him." },
  { verse: "Let the word of Christ dwell in you richly.", reference: "Colossians 3:16", subtitle: "Teach and admonish one another in wisdom." },
  { verse: "Draw near to God, and he will draw near to you.", reference: "James 4:8", subtitle: "Cleanse your hands, you sinners." },
  { verse: "He who dwells in the shelter of the Most High.", reference: "Psalm 91:1", subtitle: "Will abide in the shadow of the Almighty." },
  { verse: "Bless the Lord, O my soul.", reference: "Psalm 103:1", subtitle: "Forget not all his benefits." },
  { verse: "I can do all things through him who strengthens me.", reference: "Philippians 4:13", subtitle: "In every circumstance." },
  { verse: "The Lord is good to those who wait for him.", reference: "Lamentations 3:25", subtitle: "To the soul who seeks him." },
  { verse: "Let not your hearts be troubled.", reference: "John 14:1", subtitle: "Believe in God; believe also in me." },
  { verse: "O Lord, you have searched me and known me.", reference: "Psalm 139:1", subtitle: "You know when I sit down and when I rise up." },
  { verse: "Therefore, if anyone is in Christ, he is a new creation.", reference: "2 Corinthians 5:17", subtitle: "The old has passed away; behold, the new has come." },
  { verse: "God is our refuge and strength.", reference: "Psalm 46:1", subtitle: "A very present help in trouble." },
  { verse: "For I know the plans I have for you, declares the Lord.", reference: "Jeremiah 29:11", subtitle: "Plans for welfare and not for evil." },
  { verse: "The Lord is my rock and my fortress.", reference: "Psalm 18:2", subtitle: "My deliverer, in whom I take refuge." },
  { verse: "Ask, and it will be given to you.", reference: "Matthew 7:7", subtitle: "Seek, and you will find." },
  { verse: "My grace is sufficient for you.", reference: "2 Corinthians 12:9", subtitle: "For my power is made perfect in weakness." },
  { verse: "Love is patient and kind.", reference: "1 Corinthians 13:4", subtitle: "Love bears all things, believes all things, hopes all things." },
  { verse: "The Lord will keep you from all evil.", reference: "Psalm 121:7", subtitle: "He will keep your life." },
  { verse: "In peace I will both lie down and sleep.", reference: "Psalm 4:8", subtitle: "For you alone, O Lord, make me dwell in safety." },
  { verse: "Teach us to number our days.", reference: "Psalm 90:12", subtitle: "That we may get a heart of wisdom." },
  { verse: "Let us run with endurance the race that is set before us.", reference: "Hebrews 12:1", subtitle: "Looking to Jesus, the founder and perfecter of our faith." },
  { verse: "The Lord upholds all who are falling.", reference: "Psalm 145:14", subtitle: "And raises up all who are bowed down." },
  { verse: "Do not be anxious about anything.", reference: "Philippians 4:6", subtitle: "But in everything by prayer and supplication with thanksgiving." },
  { verse: "I lift my eyes to the hills.", reference: "Psalm 121:1", subtitle: "From where does my help come? My help comes from the Lord." },
  { verse: "A new commandment I give to you.", reference: "John 13:34", subtitle: "That you love one another." },
  { verse: "The Lord is slow to anger and abounding in steadfast love.", reference: "Psalm 145:8", subtitle: "He is good to all." },
  { verse: "Come, everyone who thirsts.", reference: "Isaiah 55:1", subtitle: "Come to the waters." },
  { verse: "For we walk by faith, not by sight.", reference: "2 Corinthians 5:7", subtitle: "Fix your eyes on what is unseen." },
  { verse: "The heavens declare the glory of God.", reference: "Psalm 19:1", subtitle: "The sky above proclaims his handiwork." },
  { verse: "You keep him in perfect peace whose mind is stayed on you.", reference: "Isaiah 26:3", subtitle: "Because he trusts in you." },
]

/** Landing verse + subtitle for the devotions home. Rotates by day (50 combos). */
export function getLandingComboForDate(date: Date): LandingCombo {
  const day = dayOfYear(date)
  const index = (day - 1) % LANDING_COMBOS.length
  return LANDING_COMBOS[index] ?? LANDING_COMBOS[0]
}
