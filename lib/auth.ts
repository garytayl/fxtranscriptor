import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminProfile = {
  user_id: string;
  email: string | null;
  role: string;
};

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, email, role")
    .eq("user_id", user.id)
    .maybeSingle();

  return profile as AdminProfile | null;
}

/** Non-throwing session for client: returns user, profile, and isAdmin. No auth required. */
export async function getSession(): Promise<{
  user: { id: string; email: string | null } | null;
  profile: { role: string } | null;
  isAdmin: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, profile: null, isAdmin: false };
  }
  let profile = await getCurrentProfile();

  // First-admin bootstrap: if FIRST_ADMIN_EMAIL is set and matches this user, and no admin exists yet, promote
  const firstAdminEmail = process.env.FIRST_ADMIN_EMAIL?.trim()?.toLowerCase();
  if (
    firstAdminEmail &&
    user.email?.toLowerCase() === firstAdminEmail &&
    profile?.role !== "admin"
  ) {
    const supabase = await createSupabaseServerClient();
    const { data: existingAdmin } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (!existingAdmin) {
      await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          email: user.email ?? null,
          role: "admin",
        },
        { onConflict: "user_id" }
      );
      profile = { user_id: user.id, email: user.email ?? null, role: "admin" } as AdminProfile;
    }
  }

  const isAdmin = !!(profile && profile.role === "admin");
  return {
    user: { id: user.id, email: user.email ?? null },
    profile: profile ? { role: profile.role } : null,
    isAdmin,
  };
}

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, email, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    supabase,
    user,
    profile: profile as AdminProfile,
  };
}

