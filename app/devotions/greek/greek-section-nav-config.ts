/** Shared Greek devotions routes for hub + quick nav (single source of truth). */
export type GreekSectionNavItem = {
  href: string
  label: string
  /** Tooltip / accessible description for cryptic short labels */
  title?: string
}

export const GREEK_SECTION_NAV: GreekSectionNavItem[] = [
  { href: "/devotions/greek", label: "Home" },
  {
    href: "/devotions/greek/lesson",
    label: "Lesson",
    title: "Mixed practice: endings, morphology, and English → Greek gloss",
  },
  { href: "/devotions/greek/endings", label: "Endings" },
  { href: "/devotions/greek/reader", label: "Reader" },
  { href: "/devotions/greek/quest", label: "Quest" },
  { href: "/devotions/greek/words", label: "Words" },
  {
    href: "/devotions/greek/english-search",
    label: "Search",
    title: "Find Greek lemmas by typing English words (e.g. love, faith, holy)",
  },
  { href: "/devotions/greek/coach", label: "Coach" },
]
