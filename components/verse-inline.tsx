"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { getBibleGatewayUrlFromReference } from "@/lib/bibleGateway";

interface VerseReference {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  full_reference: string;
}

interface VerseInlineProps {
  content: string;
  verses: VerseReference[];
}

/**
 * Parses content for verse references and replaces them with clickable badges
 * Looks for patterns like [Book Chapter:Verse] or [Book Chapter:Verse-Verse]
 */
export function VerseRichText({ content, verses }: VerseInlineProps) {
  // Create a map of verse references for quick lookup
  const verseMap = new Map<string, VerseReference>();
  verses.forEach((verse) => {
    verseMap.set(verse.full_reference, verse);
  });

  // Pattern to match verse references in brackets: [Book Chapter:Verse] or [Book Chapter:Verse-Verse]
  const versePattern = /\[([^\]]+)\]/g;

  const parts: Array<{ type: "text" | "verse"; content: string; verse?: VerseReference }> = [];
  let lastIndex = 0;
  let match;

  while ((match = versePattern.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex, match.index),
      });
    }

    // Check if the matched text is a verse reference
    const reference = match[1];
    const verse = verseMap.get(reference);

    if (verse) {
      parts.push({
        type: "verse",
        content: reference,
        verse,
      });
    } else {
      // Not a verse reference, keep as text
      parts.push({
        type: "text",
        content: match[0], // Include the brackets
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.substring(lastIndex),
    });
  }

  // If no matches, return content as-is
  if (parts.length === 0) {
    return <p className="font-mono text-sm text-foreground leading-relaxed whitespace-pre-wrap">{content}</p>;
  }

  return (
    <p className="font-mono text-sm text-foreground leading-relaxed">
      {parts.map((part, index) => {
        if (part.type === "verse" && part.verse) {
          return (
            <a
              key={index}
              href={getBibleGatewayUrlFromReference(part.verse.full_reference)}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 mx-1"
            >
              <Badge
                variant="outline"
                className="font-mono text-xs border-accent/50 text-accent bg-accent/10 hover:bg-accent/20 hover:border-accent/70 transition-all cursor-pointer"
              >
                {part.content}
                <ExternalLink className="size-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Badge>
            </a>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </p>
  );
}
