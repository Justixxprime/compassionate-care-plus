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
    // Photos are drawn by SiteImage (a plain img tag, see
    // src/components/marketing/site-image.tsx). These hosts are allowed
    // in case a photo is ever moved to next/image. See docs/IMAGES.md.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
