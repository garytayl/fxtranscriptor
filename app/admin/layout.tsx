import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminLayoutContent } from "@/components/admin/admin-layout-content";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </div>
  );
}

