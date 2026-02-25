import { DevotionsClient } from "./devotions-client"

export const metadata = {
  title: "Devotions",
  description: "Private devotions and reflections. Stored on your device only — export a backup anytime.",
}

export default function DevotionsPage() {
  return <DevotionsClient />
}
