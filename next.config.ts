import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allows next/image to optimize photos hosted on Pexels, once the
    // hero/about photos switch from plain <img> tags to next/image.
    // See docs/IMAGES.md.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
};

export default nextConfig;
