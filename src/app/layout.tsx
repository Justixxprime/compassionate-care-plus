import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cheliv Compassionate Care Plus",
  description:
    "Cheliv Compassionate Care Plus Inc. Home health care serving Texas.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-white text-neutral-900">
        <noscript>
          <style>{`.reveal { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}