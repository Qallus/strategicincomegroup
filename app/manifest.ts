import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Strategic Income Group",
    short_name: "SIG",
    description: "Strategic Income Group team dashboard — clients, appointments, communications, and projects.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#070c1d",
    theme_color: "#0d2568",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
