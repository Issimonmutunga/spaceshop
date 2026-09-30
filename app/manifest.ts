import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Locus — where is it",
    short_name: "Locus",
    description: "A spatial memory for physical things.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6F5F1",
    theme_color: "#F6F5F1",
    orientation: "any",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Find", url: "/" },
      { name: "Scan", url: "/scan" },
      { name: "Map", url: "/map" },
    ],
  };
}
