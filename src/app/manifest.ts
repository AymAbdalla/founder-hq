import type { MetadataRoute } from "next";

// Makes HQ installable: added to an iPhone's Home Screen or a Mac's Dock, it opens in its own
// window like an app (spec 3.5).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Founder HQ",
    short_name: "HQ",
    description: "To-dos, reminders, ideas and features for every project you're building.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f1f17",
    theme_color: "#0f1f17",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
