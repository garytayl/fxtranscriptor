import { MeditationPicker } from "./meditation-picker"

export const metadata = {
  title: "Meditation",
  description: "Choose a scripture meditation series or today’s passage — read, write, reflect.",
}

export default function MeditationPage() {
  return <MeditationPicker />
}
