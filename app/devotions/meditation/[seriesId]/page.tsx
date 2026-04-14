import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { MeditationSessionClient } from "../meditation-session-client"
import { getMeditationSeries } from "@/lib/meditation-series"

type Props = { params: Promise<{ seriesId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seriesId } = await params
  const s = getMeditationSeries(seriesId)
  if (!s) return { title: "Meditation" }
  return {
    title: s.title,
    description: s.description,
  }
}

export default async function MeditationSeriesPage({ params }: Props) {
  const { seriesId } = await params
  if (!getMeditationSeries(seriesId)) notFound()
  return <MeditationSessionClient seriesId={seriesId} />
}
