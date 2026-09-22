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
  inside the header. That is deliberate: an `absolute` panel is
  positioned against whichever ancestor happens to be positioned, and a
  narrow flex child (the menu button's own wrapper) is not a reliable
  anchor for a full-width panel - that mismatch is what pushed the panel
  off the right edge of the screen before. `fixed inset-y-0 right-0`
  anchors to the viewport itself, so it cannot drift no matter what sits
  around the button.
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
  // The phone panel has room to breathe; the sidebar stays a little
  // denser so more of the menu is visible without scrolling.
  spacious?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={spacious ? "space-y-7" : "space-y-6"}>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-caption font-semibold uppercase tracking-wide text-slate">
            {group.label}
          </p>
          <ul className={cn("mt-2", spacious ? "space-y-1" : "space-y-0.5")}>
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
                      "flex items-center gap-3 rounded-md font-medium transition-colors",
                      spacious
                        ? "min-h-12 px-3.5 text-body"
                        : "min-h-11 px-3 text-body-sm",
                      current
                        ? "bg-sage text-pine-dark"
                        : "text-ink hover:bg-sage/60",
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
  const [open, setOpen] = useState(false);

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

      {/* The panel itself. Fixed to the viewport (see the note above the
          component) and always mounted, sliding in and out by transform,
          so the animation is smooth in both directions. */}
      <div
        id="mobile-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[19rem] max-w-[85vw] flex-col border-l border-border bg-white shadow-raised transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex h-16 flex-none items-center justify-between border-b border-border px-5">
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
            className="flex h-11 w-11 flex-none items-center justify-center rounded-md border border-border-strong bg-white"
          >
            <X className="h-5 w-5 text-ink" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <NavList groups={groups} onNavigate={() => setOpen(false)} spacious />
        </div>

        <div className="flex-none border-t border-border px-5 py-5">
          {footer}
        </div>
      </div>
    </div>
  );
}
