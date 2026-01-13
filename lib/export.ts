/**
 * Export utilities for sermons data
 */

import { Sermon } from './supabase'

export function exportToCSV(sermons: Sermon[]): string {
  const headers = ['Title', 'Date', 'Status', 'Transcript Length', 'YouTube URL', 'Podbean URL', 'Audio URL']
  const rows = sermons.map(sermon => [
    sermon.title || '',
    sermon.date ? new Date(sermon.date).toLocaleDateString() : '',
    sermon.status || 'pending',
    sermon.transcript ? sermon.transcript.length.toString() : '0',
    sermon.youtube_url || '',
    sermon.podbean_url || '',
    sermon.audio_url || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  return csvContent
}

export function exportToJSON(sermons: Sermon[]): string {
  return JSON.stringify(sermons, null, 2)
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
