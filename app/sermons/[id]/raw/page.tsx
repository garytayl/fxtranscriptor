/**
 * Plain transcript page - minimal HTML with no styling
 * Shows full transcript text in raw format
 */

import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export default async function RawTranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!supabase) {
    return notFound();
  }

  const { data: sermon, error } = await supabase
    .from("sermons")
    .select("title, transcript")
    .eq("id", id)
    .maybeSingle();

  if (error || !sermon || !sermon.transcript) {
    return notFound();
  }

  return (
    <html>
      <head>
        <title>{sermon.title || "Transcript"}</title>
        <meta charSet="utf-8" />
      </head>
      <body>
        <pre style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", padding: "1rem" }}>
          {sermon.transcript}
        </pre>
      </body>
    </html>
  );
}
