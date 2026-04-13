import { GreekGrammarReaderClient } from "./greek-grammar-reader-client"

export const metadata = {
  title: "Learn Greek · Grammar reader",
  description:
    "Read pilot NT verses one at a time: tap any word for morphology, grammar notes, and optional hints—without quizzes or XP.",
}

export default function DevotionsGreekPage() {
  return <GreekGrammarReaderClient />
}
