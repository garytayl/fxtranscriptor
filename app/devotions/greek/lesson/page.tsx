import { GreekLessonLabClient } from "@/app/devotions/greek/greek-lesson-lab-client"

export const metadata = {
  title: "Greek lesson · Practice",
  description:
    "Mixed drills: endings, Greek roots and combining forms, vocabulary, and verse grammar—piece words together with XP.",
}

export default function GreekLessonPage() {
  return <GreekLessonLabClient />
}
