"use client";

import Link from "next/link";
import { HeroSection } from "@/components/hero-section";
import { BookOpen, Mic, BookMarked, Sparkles, LogIn } from "lucide-react";

const sections = [
  {
    label: "Sermons",
    href: "/sermons",
    description: "Sermon transcript archive. Browse by series, search, and read or download transcripts.",
    icon: Mic,
  },
  {
    label: "Studies",
    href: "/studies",
    description: "Bible studies and discussion guides.",
    icon: BookOpen,
  },
  {
    label: "Scripture",
    href: "/bible",
    description: "Read Scripture with multiple translations and word study.",
    icon: BookMarked,
  },
  {
    label: "Devotions",
    href: "/devotions",
    description: "Daily devotions and short readings.",
    icon: Sparkles,
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10">
        <HeroSection primaryCtaHref="/sermons" recentHref="/sermons" />

        <section
          id="sections"
          className="relative py-24 md:py-32 pl-4 sm:pl-6 md:pl-12 pr-4 sm:pr-6 md:pr-12 border-t border-border/30"
        >
          <div className="mb-16">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
              Explore
            </span>
            <h2 className="mt-4 font-display text-3xl sm:text-5xl md:text-7xl tracking-tight">
              SECTIONS
            </h2>
            <p className="mt-4 max-w-md font-mono text-xs text-muted-foreground leading-relaxed">
              Sermon transcripts, Bible studies, Scripture reader, and devotions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {sections.map(({ label, href, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group block border border-border/50 rounded-lg p-6 sm:p-8 hover:border-accent/50 hover:bg-card/50 transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center size-10 rounded-lg border border-border/50 group-hover:border-accent/50 transition-colors">
                    <Icon className="size-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </span>
                  <span className="font-mono text-xs uppercase tracking-widest text-foreground">
                    {label}
                  </span>
                </div>
                <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
                <span className="mt-4 inline-block font-mono text-[10px] uppercase tracking-widest text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  Enter →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-16 pt-12 border-t border-border/30 flex justify-center">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
            >
              <LogIn className="size-4" />
              Admin
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
