import { RomansJourneyClient } from "./romans-journey-client"

export const metadata = {
  title: "Romans Journey",
  description: "Step-by-step guided walk through Paul’s letter—reflection, scripture, Greek tools.",
}

export default function RomansJourneyPage() {
  return <RomansJourneyClient />
}
