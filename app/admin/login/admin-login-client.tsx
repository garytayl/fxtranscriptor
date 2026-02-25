"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function AdminLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace(redirectTo);
      }
    };

    checkSession();
  }, [redirectTo, router]);

  useEffect(() => {
    if (errorParam === "forbidden") {
      setError(
        "Your account does not have admin access. If you just signed in for the first time, try again (the app promotes the FIRST_ADMIN_EMAIL user on first access). If the problem persists, add a row in Supabase → profiles with your user_id and role = 'admin'."
      );
    }
  }, [errorParam]);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace(redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isNetwork =
        /load failed|failed to fetch|network error|networkconnection|lost/i.test(message) ||
        (err instanceof TypeError && message.toLowerCase().includes("fetch"));
      setError(
        isNetwork
          ? "Connection failed. Check your network and that Supabase is reachable (NEXT_PUBLIC_SUPABASE_URL). Try again."
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 pt-[var(--navbar-offset)]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Sign In</CardTitle>
          <CardDescription>Sign in to manage sermons and series.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Passwords are managed by Supabase Auth. First time? Set <code className="bg-muted px-1 rounded">FIRST_ADMIN_EMAIL</code> to your email in env, create that user in Supabase Dashboard → Authentication → Users, then sign in here once to become admin. See SETUP.md for details.
          </p>
          <form onSubmit={handleSignIn} className="space-y-4">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
