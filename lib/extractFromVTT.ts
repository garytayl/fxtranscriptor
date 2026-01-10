/**
 * Extracts transcript text from WebVTT format
 * Parses VTT files and converts cue text to readable paragraphs
 */

export interface VTTParseResult {
  success: boolean;
  transcript: string;
}

export function extractFromVTT(vttContent: string): VTTParseResult {
  if (!vttContent || typeof vttContent !== "string") {
    return { success: false, transcript: "" };
  }

  try {
    // Remove WEBVTT header and metadata
    let content = vttContent.replace(/^WEBVTT\s*$/m, "").trim();

    // Extract cue text (between timestamps and newlines)
    // Pattern: timestamp --> timestamp\ncue text\n
    const cuePattern = /(?:\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*?\n)([^\n]+(?:\n(?!\d{2}:\d{2}:\d{2})[^\n]+)*)/g;

    const cues: string[] = [];
    let match;

    while ((match = cuePattern.exec(content)) !== null) {
      const cueText = match[1].trim();
      if (cueText && !cueText.match(/^\d+$/)) {
        // Skip cue identifiers (just numbers)
        cues.push(cueText);
      }
    }

    // Alternative simpler approach: extract text after timestamps
    if (cues.length === 0) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip timestamps and empty lines
        if (
          !line.match(/^\d{2}:\d{2}:\d{2}/) &&
          !line.match(/^-->$/) &&
          line.length > 0 &&
          !line.match(/^NOTE /) &&
          !line.match(/^STYLE /) &&
          !line.match(/^\d+$/) // Skip cue identifiers
        ) {
          cues.push(line);
        }
      }
    }

    const transcript = cues.join("\n\n").trim();

    return {
      success: transcript.length > 0,
      transcript,
    };
  } catch (error) {
    console.error("Error parsing VTT:", error);
    return { success: false, transcript: "" };
  }
}
