/**
 * Cleans and normalizes transcript text
 * - Removes timestamps
 * - Normalizes whitespace
 * - Removes extra spacing between paragraphs
 */
export function cleanTranscript(text: string): string {
  if (!text) return "";

  return text
    // Remove WebVTT timestamps (00:00:00.000 --> 00:00:05.000)
    .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, "")
    // Remove simple timestamps (00:00:00 or 0:00)
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, "")
    // Remove speaker labels (Speaker 1:, [Speaker Name], etc.)
    .replace(/^(?:Speaker\s*\d+|\[.*?\]|\w+:\s*)/gm, "")
    // Remove HTML tags if any remain
    .replace(/<[^>]*>/g, "")
    // Remove WebVTT cue identifiers
    .replace(/^\d+$/gm, "")
    // Remove empty lines
    .replace(/^\s*$/gm, "")
    // Normalize multiple spaces to single space
    .replace(/[ \t]+/g, " ")
    // Normalize multiple newlines to double newline (paragraph break)
    .replace(/\n{3,}/g, "\n\n")
    // Trim each line
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n\n")
    .trim();
}
