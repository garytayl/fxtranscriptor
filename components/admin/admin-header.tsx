"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AdminHeader() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/admin/login");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="border-b border-border/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Admin Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="font-mono text-xs uppercase tracking-widest">
            <Link href="/">View Site</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="font-mono text-xs uppercase tracking-widest"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>
    </header>
  );
}

