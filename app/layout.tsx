import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FX Transcriptor - Extract Podcast Transcripts",
  description: "Extract clean, copyable transcripts from Apple Podcasts episodes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-white min-h-screen">{children}</body>
    </html>
  );
}
