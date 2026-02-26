/**
 * API Route: Queue + Worker Status (debug)
 * Admin only. Returns whether worker is configured, reachable, and queue summary.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) {
      return auth.response;
    }

    const workerUrl = process.env.AUDIO_WORKER_URL?.trim();
    let workerReachable: boolean | null = null;
    let workerError: string | null = null;

    if (workerUrl) {
      try {
        const healthUrl = workerUrl.replace(/\/$/, "") + "/health";
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(8000) });
        workerReachable = res.ok;
        if (!res.ok) {
          workerError = `Worker returned ${res.status}`;
        }
      } catch (err) {
        workerReachable = false;
        workerError = err instanceof Error ? err.message : String(err);
      }
    }

    let queueSummary: { processingSermonId: string | null; queuedCount: number } = {
      processingSermonId: null,
      queuedCount: 0,
    };

    try {
      const supabase = createSupabaseAdminClient();
      const { data: processing } = await supabase
        .from("transcription_queue")
        .select("sermon_id")
        .eq("status", "processing")
        .maybeSingle();
      const { count: queuedCount } = await supabase
        .from("transcription_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "queued");
      queueSummary = {
        processingSermonId: processing?.sermon_id ?? null,
        queuedCount: queuedCount ?? 0,
      };
    } catch (e) {
      queueSummary = {
        processingSermonId: null,
        queuedCount: 0,
      };
    }

    return NextResponse.json({
      workerConfigured: !!workerUrl,
      workerReachable,
      workerError: workerError ?? undefined,
      queue: queueSummary,
      hint: !workerUrl
        ? "Set AUDIO_WORKER_URL in Vercel to your Railway worker URL (e.g. https://xxx.railway.app)."
        : workerReachable === false
          ? "Worker not reachable. Check Railway is running and URL has no trailing slash."
          : "Worker OK. If stuck, use 'Trigger processor now' or check cron runs every 2 min.",
    });
  } catch (error) {
    console.error("Error in queue status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
