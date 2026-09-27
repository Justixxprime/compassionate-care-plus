import type { Metadata } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/app/pwa-registration";

export const metadata: Metadata = {
  title: "Cheliv Compassionate Care Plus",
  description:
    "Cheliv Compassionate Care Plus Inc. Home health care serving Texas.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  applicationName: "Cheliv",
  appleWebApp: { capable: true, title: "Cheliv", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-full bg-white text-neutral-900"
        suppressHydrationWarning
      >
        <noscript>
          <style>{`.reveal { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
