"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return (
      <main className="w-full px-4 py-10 sm:px-6">
        {children}
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[240px_1fr]">
      <AdminSidebar />
      <section className="min-w-0">{children}</section>
    </main>
  );
}
