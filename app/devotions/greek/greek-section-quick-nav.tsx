"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { GREEK_SECTION_NAV } from "@/app/devotions/greek/greek-section-nav-config"
import { cn } from "@/lib/utils"

export function GreekSectionQuickNav({
  className,
  /** e.g. "emerald" for quest, "amber" for reader */
  activeVariant = "emerald",
}: {
  className?: string
  activeVariant?: "emerald" | "amber"
}) {
  const pathname = usePathname()

  const activeRing =
    activeVariant === "amber"
      ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
      : "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
  const idle = "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"

  return (
    <nav
      className={cn("flex flex-wrap gap-1.5", className)}
      aria-label="Greek study sections"
    >
      {GREEK_SECTION_NAV.map((item) => {
        const active =
          item.href === "/devotions/greek"
            ? pathname === "/devotions/greek"
            : pathname === item.href || pathname?.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors",
              active ? activeRing : idle,
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
