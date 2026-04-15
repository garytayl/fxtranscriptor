import { redirect } from "next/navigation"

export const metadata = {
  title: "Learn Greek · Endings lab",
  description:
    "Start with memorization tables and quick endings drills before entering Verse Quest or Grammar Reader.",
}

export default function DevotionsGreekPage() {
  redirect("/devotions/greek/endings")
}
