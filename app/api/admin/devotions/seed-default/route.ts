import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Admin: seed the default "Immigration" topical study so the weekly topical study page has content. Uses service role so RLS does not block. */
export async function POST() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("devotion_topics")
    .select("id")
    .eq("slug", "immigration")
    .maybeSingle();

  const row = {
    title: "Immigration — What the Bible Says",
    slug: "immigration",
    description:
      "What Scripture says about the stranger, the sojourner, and loving our neighbor.",
    body: `## Overview

Scripture repeatedly calls God's people to care for the foreigner and sojourner. This study highlights key passages and themes.

## Key themes

- **The sojourner in the Law** — Israel was commanded to love and not oppress the stranger (Exodus, Leviticus, Deuteronomy).
- **Justice and mercy** — God identifies with the vulnerable; how we treat the stranger reflects our heart.
- **The church as a new family** — In Christ there is no Jew nor Greek; we are one in him.

## Reflection

How might your community extend hospitality and justice to immigrants and refugees?`,
    bible_references: [
      "Exodus 22:21",
      "Leviticus 19:33-34",
      "Deuteronomy 10:18-19",
      "Matthew 25:35",
      "Hebrews 13:2",
    ],
    sort_order: 0,
    published: true,
    is_current: true,
    featured_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("devotion_topics")
      .update(row)
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      message: "Default topic (Immigration) updated.",
      slug: "immigration",
    });
  }

  await supabase.from("devotion_topics").update({ is_current: false }).eq("is_current", true);

  const { data: inserted, error } = await supabase
    .from("devotion_topics")
    .insert(row)
    .select("id, slug")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Default topic (Immigration) added. It will appear on the Weekly topical study page.",
    slug: inserted?.slug ?? "immigration",
  });
}
