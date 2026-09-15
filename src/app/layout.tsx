import { DevelopmentBanner } from "@/components/marketing/development-banner";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";

/*
  Every page under app/(public)/ renders inside this. The route group -
  the parentheses in the folder name - organizes files without adding
  anything to the URL, so app/(public)/about/page.tsx is still just
  "/about".

  This is deliberately a SEPARATE layout from the portals. The public site
  and the internal application share color and type tokens but not this
  chrome - see docs/PHASE_0_ARCHITECTURE.md section 1.
*/

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DevelopmentBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
