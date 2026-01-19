import { Suspense } from "react";
import { AdminLoginClient } from "./admin-login-client";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center px-6 text-sm text-muted-foreground">
          Loading admin login...
        </div>
      }
    >
      <AdminLoginClient />
    </Suspense>
  );
}

