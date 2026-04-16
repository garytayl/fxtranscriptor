import { GreekDevotionsHubClient } from "@/app/devotions/greek/greek-devotions-hub-client"

export const metadata = {
  title: "Greek study · Devotions",
  description:
    "Endings Lab, Grammar Reader, Verse Quest, and Word bank—Koine Greek practice with MorphGNT pilot chapters.",
}

export default function DevotionsGreekPage() {
  return <GreekDevotionsHubClient />
}
