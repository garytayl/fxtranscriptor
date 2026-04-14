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
  }
}
