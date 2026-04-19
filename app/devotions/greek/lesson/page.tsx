import { GreekLessonLabClient } from "@/app/devotions/greek/greek-lesson-lab-client"

export const metadata = {
  title: "Greek lesson · Practice",
  description: "Full-screen mixed drills: endings, vocabulary, and verse grammar with XP.",
}

export default function GreekLessonPage() {
  return <GreekLessonLabClient />
}
