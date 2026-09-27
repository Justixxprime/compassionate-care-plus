import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cheliv Compassionate Care Plus",
    short_name: "Cheliv",
    description: "Cheliv Compassionate Care Plus secure care coordination.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF9F6",
    theme_color: "#1C4A3C",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
