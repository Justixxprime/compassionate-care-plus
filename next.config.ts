import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Document uploads (src/lib/documents-actions.ts) travel as a Server
  // Action request, which Next.js caps at 1 MB unless told otherwise. A
  // document may be up to 2 MB (MAX_DOCUMENT_BYTES), and multipart
  // uploads add some overhead of their own, so the cap is raised to 3 MB.
  // The real size limit is still enforced by the server code, not here.
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
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
