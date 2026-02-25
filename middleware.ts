import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminLogin = pathname === "/admin/login";

  if ((isAdminRoute || isAdminApi) && !isAdminLogin) {
    if (!user) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    let { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    // First-admin bootstrap: if FIRST_ADMIN_EMAIL matches and no admin exists yet, promote this user (so first sign-in works)
    const firstAdminEmail = process.env.FIRST_ADMIN_EMAIL?.trim()?.toLowerCase();
    if (
      (!profile || profile.role !== "admin") &&
      firstAdminEmail &&
      user.email?.toLowerCase() === firstAdminEmail
    ) {
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
        profile = { role: "admin" };
      }
    }

    if (!profile || profile.role !== "admin") {
      if (isAdminApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("error", "forbidden");
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

