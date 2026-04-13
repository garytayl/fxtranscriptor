import { GreekOneVerseClient } from "./greek-one-verse-client"

export const metadata = {
  title: "Learn Greek · Devotions",
  description: "Step through John 1 or Luke 6 one verse at a time, then open the Scripture reader with Greek morphology.",
}

export default function DevotionsGreekPage() {
  return <GreekOneVerseClient />
}
