import type { MetadataRoute } from "next"

/** Enables Add to Home Screen / install prompts on supported browsers; start at devotions. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "fxarchives",
    short_name: "fxarchives",
    description: "Sermon archive and daily devotions from fxchurch.",
    start_url: "/devotions",
    scope: "/",
    display: "standalone",
    background_color: "#030407",
    theme_color: "#0a0f1a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Greek study",
        short_name: "Greek",
        description: "Labs, reader, and verse quest",
        url: "/devotions/greek",
        icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
      },
      {
        name: "Verse Quest",
        short_name: "Quest",
        description: "Guided Greek drills and XP",
        url: "/devotions/greek/quest",
        icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
      },
      {
        name: "Greek study coach",
        short_name: "Coach",
        description: "AI coach with your progress context",
        url: "/devotions/greek/coach",
        icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
      },
    ],
  }
}
