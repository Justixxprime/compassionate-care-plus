import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compassionate Care Plus",
  description:
    "Digital platform for Compassionate Care Plus Inc. Development build using synthetic data only.",
  // This is a development build. Search engines should not index it.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-white text-neutral-900">{children}</body>
    </html>
  );
}
