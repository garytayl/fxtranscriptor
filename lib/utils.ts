import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Decode common HTML entities in text (e.g. &amp; → &). Use for sermon titles from RSS/API. */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (text == null || text === "") return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** e.g. "15s ago", "2m ago" for progress "last updated" display */
export function formatRelativeTime(isoString: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}
