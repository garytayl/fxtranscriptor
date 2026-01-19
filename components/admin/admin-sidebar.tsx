"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard", label: "Sermon Manager" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="space-y-4">
      <div className="space-y-1">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Admin</div>
        <h2 className="text-2xl font-serif text-foreground">Controls</h2>
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors",
                isActive
                  ? "border-primary/60 text-foreground"
                  : "border-border/50 text-foreground/70 hover:border-primary/50 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

