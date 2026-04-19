import type { ReactNode } from "react"

import { GreekXpCelebrationLayer } from "@/app/devotions/greek/greek-xp-celebration-layer"

export default function GreekDevotionsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <GreekXpCelebrationLayer />
    </>
  )
}
