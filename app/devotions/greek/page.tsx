import { GreekOneVerseClient } from "./greek-one-verse-client"

export const metadata = {
  title: "Learn Greek · Devotions",
  description:
    "Step through John 1 or Luke 6 one verse at a time with in-page Greek grammar, morphology hints, and tap-to-learn word breakdowns.",
}

export default function DevotionsGreekPage() {
  return <GreekOneVerseClient />
}
