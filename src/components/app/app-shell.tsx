import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { LogoMark } from "@/components/marketing/logo-mark";
import { MobileMenu, SidebarNav } from "@/components/app/app-nav";
import type { NavGroup } from "@/lib/app/navigation";

/*
  AppShell
  ========
  The frame every signed-in staff screen sits in: a sidebar on wide
  screens, a top bar with a menu button on phones, and the page itself in
  the middle.

  It is drawn on the server. It is given a finished menu and the person's
  name and role words; it decides nothing about access. Which pages exist
  for this person was decided in src/lib/app/navigation.ts from their real
  permissions, and each page checks again on its own
  (src/lib/app/access.ts explains why the shell is not the lock).

  The application deliberately looks different from the public site: the
  same colors and type, but denser and quieter, because it is a working
  tool, not a first impression (docs/PHASE_0_ARCHITECTURE.md section 1).
*/

function BrandLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <LogoMark className="h-8 w-8 flex-none" />
      <span className="leading-none">
        <span className="block font-display text-body-lg font-semibold tracking-tight text-ink">
          Cheliv
        </span>
        {compact ? null : (
          <span className="block text-caption text-slate">
            Compassionate Care Plus
          </span>
        )}
      </span>
    </Link>
  );
}

// Who is signed in, the demonstration note, and the way out. Drawn twice
// (sidebar and phone menu), so it lives in one place.
function AccountPanel({
  userName,
  roleLabel,
}: {
  userName: string;
  roleLabel: string;
}) {
  return (
    <div>
      <p className="truncate text-body-sm font-medium text-ink">{userName}</p>
      <p className="truncate text-caption text-slate">{roleLabel}</p>
      <form action={signOutAction} className="mt-3">
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-white px-3 text-body-sm font-medium text-ink transition-colors hover:bg-sage"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </form>
      <p className="mt-3 text-caption text-slate">
        Demonstration data. Every patient here is made up.
      </p>
    </div>
  );
}

export function AppShell({
  userName,
  roleLabel,
  groups,
  children,
}: {
  userName: string;
  roleLabel: string;
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-body-sm focus:font-medium focus:text-ink focus:shadow-raised"
      >
        Skip to the page
      </a>

      {/* Wide screens: a fixed sidebar. */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-none lg:flex-col lg:border-r lg:border-border lg:bg-white">
        <div className="px-5 py-5">
          <BrandLink />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <SidebarNav groups={groups} />
        </div>
        <div className="border-t border-border px-5 py-4">
          <AccountPanel userName={userName} roleLabel={roleLabel} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones and tablets: a top bar with the menu button. */}
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur lg:hidden">
          <div className="relative flex h-16 items-center justify-between px-4">
            <BrandLink compact />
            <MobileMenu
              groups={groups}
              footer={<AccountPanel userName={userName} roleLabel={roleLabel} />}
            />
          </div>
        </header>

        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
