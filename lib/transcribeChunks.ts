/**
 * Transcribe audio chunks and merge results
 */

import { transcribeWithWhisper } from "./transcribeWithWhisper";

export interface ChunkInfo {
  url: string;
  index: number;
  duration?: number;
  startTime?: number;
}

export interface TranscribeChunksResult {
  success: boolean;
  transcript: string;
  error?: string;
}

/**
 * Transcribes multiple audio chunks and merges them in order
 */
export async function transcribeChunks(
  chunks: ChunkInfo[],
  apiKey: string,
  onProgress?: (chunkIndex: number, totalChunks: number) => void
): Promise<TranscribeChunksResult> {
  try {
    if (!chunks || chunks.length === 0) {
      return {
        success: false,
        transcript: "",
        error: "No chunks provided",
      };
    }

    console.log(`[TranscribeChunks] Starting transcription of ${chunks.length} chunks`);

    const transcripts: string[] = [];
    
    // Transcribe each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkNum = i + 1;
      
      console.log(`[TranscribeChunks] Transcribing chunk ${chunkNum}/${chunks.length}: ${chunk.url.substring(0, 80)}...`);
      
      if (onProgress) {
        onProgress(chunkNum, chunks.length);
      }

      try {
        const result = await transcribeWithWhisper(chunk.url, apiKey);
        
        if (!result.success || !result.transcript || result.transcript.trim().length < 50) {
          console.error(`[TranscribeChunks] Chunk ${chunkNum} transcription failed: ${result.error || "Empty transcript"}`);
          return {
            success: false,
            transcript: transcripts.join("\n\n"), // Return partial transcript
            error: `Chunk ${chunkNum} transcription failed: ${result.error || "Empty transcript"}`,
          };
        }

        transcripts.push(result.transcript.trim());
        console.log(`[TranscribeChunks] ✅ Chunk ${chunkNum}/${chunks.length} completed (${result.transcript.length} chars)`);
      } catch (error) {
        console.error(`[TranscribeChunks] Chunk ${chunkNum} transcription error:`, error);
        return {
          success: false,
          transcript: transcripts.join("\n\n"), // Return partial transcript
          error: `Chunk ${chunkNum} transcription error: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }

    // Merge all transcripts with paragraph breaks
    const finalTranscript = transcripts.join("\n\n");

    console.log(`[TranscribeChunks] ✅ All ${chunks.length} chunks transcribed successfully (${finalTranscript.length} chars total)`);

    return {
      success: true,
      transcript: finalTranscript,
    };
  } catch (error) {
    console.error("[TranscribeChunks] Error transcribing chunks:", error);
    return {
      success: false,
      transcript: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
