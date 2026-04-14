import { MeditationClient } from "./meditation-client"

export const metadata = {
  title: "Meditation",
  description: "One passage, full screen — read, write, receive gentle reflection prompts.",
}

export default function MeditationPage() {
  return <MeditationClient />
}
