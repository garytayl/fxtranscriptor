/** Shared Greek devotions routes for hub + quick nav (single source of truth). */
export type GreekSectionNavItem = {
  href: string
  label: string
}

export const GREEK_SECTION_NAV: GreekSectionNavItem[] = [
  { href: "/devotions/greek", label: "Home" },
  { href: "/devotions/greek/endings", label: "Endings" },
  { href: "/devotions/greek/reader", label: "Reader" },
  { href: "/devotions/greek/quest", label: "Quest" },
  { href: "/devotions/greek/words", label: "Words" },
]
