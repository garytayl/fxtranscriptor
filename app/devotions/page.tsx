import { DevotionsClient } from "./devotions-client"

export const metadata = {
  title: "Devotions",
  description: "One passage a day. Sit with Scripture—prayer and reflection stored on your device only.",
}

export default function DevotionsPage() {
  return <DevotionsClient />
}
