"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/marketing/logo-mark";
import {
  isCurrentPath,
  type NavGroup,
  type NavIconKey,
} from "@/lib/app/navigation";

/*
  The menus of the internal app: a sidebar on wide screens and a menu
  button on phones.

  These are Client Components for exactly one reason: they need to know
  which page is open so the current link can be highlighted
  (usePathname). Everything else about the shell is drawn on the server.

  The list of links arrives here already decided. The server worked out
  what this person may use (src/lib/app/navigation.ts) and passed only
  that. Nothing in this file decides access, and hiding a link protects
  nothing: every page and action re-checks permission and reach on the
  server.

  The phone panel is `position: fixed` to the viewport, not `absolute`
  inside the header, so it cannot drift off-screen no matter what sits
  around the button.

  Closing the panel does NOT rely only on each link's onClick. A click
  handler on a Next.js Link is not a reliable place to hang "close the
  menu" on its own: the shell around it (src/app/(app)/layout.tsx) is a
  Server Component that can legitimately re-run on navigation, and
  exactly when a Client Component underneath it keeps or loses state is
  an implementation detail, not a guarantee. So the panel also watches
  the current path directly (usePathname) and closes itself the instant
  the path changes, for ANY reason - a nav-item click, the browser back
  button, anything. That is the one path that cannot fail to close it.
*/

const ICONS: Record<NavIconKey, LucideIcon> = {
  home: LayoutDashboard,
  patients: Users,
  visits: CalendarDays,
  carePlans: ClipboardList,
  referrals: Inbox,
  documents: FileText,
};

function NavList({
  groups,
  onNavigate,
  spacious = false,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
  // The phone panel has room to breathe; the sidebar stays a touch
  // denser so more of the menu is visible without scrolling, but both
  // now get real air between groups.
  spacious?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={spacious ? "space-y-8" : "space-y-7"}>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-caption font-semibold uppercase tracking-wide text-slate">
            {group.label}
          </p>
          <ul className={cn("mt-3", spacious ? "space-y-1.5" : "space-y-1")}>
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const current = isCurrentPath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md border-l-2 font-medium transition-colors",
                      spacious
                        ? "min-h-12 px-3.5 text-body"
                        : "min-h-11 px-3 text-body-sm",
                      current
                        ? "border-pine bg-sage text-pine-dark"
                        : "border-transparent text-ink hover:bg-sage/60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "flex-none",
                        spacious ? "h-5 w-5" : "h-[1.125rem] w-[1.125rem]",
                        current ? "text-pine" : "text-slate",
                      )}
                      aria-hidden="true"
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// The sidebar's list of links (wide screens).
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  return <NavList groups={groups} spacious />;
}

// The menu button and the panel it opens (phones and tablets). `footer` is
// drawn by the server (the person's name and the sign-out button) and only
// placed here.
export function MobileMenu({
  groups,
  footer,
}: {
  groups: NavGroup[];
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // The one guaranteed close: whenever the visible page changes for any
  // reason - a nav-item click, the browser back button, anything - shut
  // the panel. This adjusts state during render rather than in an
  // effect (React's own recommended pattern for "reset something when a
  // value changes"), so it can't race with, or get skipped by, whatever
  // else is happening on navigation.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    if (open) setOpen(false);
  }

  // Escape closes the menu, and the page behind it stops scrolling while
  // the panel is open, as expected of any full-screen menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Close automatically if the screen is resized up to the desktop
  // sidebar breakpoint while the panel happens to be open.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)");
    const onChange = () => setOpen(false);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-border-strong bg-white"
      >
        <Menu className="h-5 w-5 text-ink" aria-hidden="true" />
      </button>

      {/* Backdrop. Always mounted (not just when open) so the fade-out
          plays instead of the panel simply vanishing. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* The panel itself. Fixed to the viewport and always mounted,
          sliding in and out by transform, so the animation is smooth in
          both directions. */}
      <div
        id="mobile-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[20rem] max-w-[88vw] flex-col border-l border-border bg-white shadow-raised transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex h-16 flex-none items-center justify-between border-b border-border px-6">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5"
          >
            <LogoMark className="h-7 w-7 flex-none" />
            <span className="font-display text-body-lg font-semibold tracking-tight text-ink">
              Cheliv
            </span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-md border border-border-strong bg-white transition-colors hover:bg-sage"
          >
            <X className="h-5 w-5 text-ink" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-7">
          <NavList groups={groups} onNavigate={() => setOpen(false)} spacious />
        </div>

        <div className="flex-none border-t border-border px-6 py-6">
          {footer}
        </div>
      </div>
    </div>
  );
}
