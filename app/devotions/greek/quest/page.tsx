import { GreekVerseQuestClient } from "../greek-verse-quest-client"

export const metadata = {
  title: "Verse Quest · Learn Greek",
  description:
    "Practice Koine Greek with verse targets, lemma quizzes, streaks, and XP—using the same MorphGNT pilot passages.",
}

export default function DevotionsGreekQuestPage() {
  return <GreekVerseQuestClient />
}
