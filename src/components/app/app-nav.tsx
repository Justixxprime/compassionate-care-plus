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
  nothing: every page and action checks again on the server.
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
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-caption font-semibold text-slate">
            {group.label}
          </p>
          <ul className="mt-1.5 space-y-0.5">
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
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-body-sm font-medium transition-colors",
                      current
                        ? "bg-sage text-pine-dark"
                        : "text-ink hover:bg-sage/60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[1.125rem] w-[1.125rem] flex-none",
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
  return <NavList groups={groups} />;
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

  // Escape closes the menu, as a keyboard user expects.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-border-strong bg-white"
      >
        {open ? (
          <X className="h-5 w-5 text-ink" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5 text-ink" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div
          id="mobile-menu-panel"
          className="absolute inset-x-0 top-full z-30 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-white px-4 pb-5 pt-4 shadow-raised"
        >
          <NavList groups={groups} onNavigate={() => setOpen(false)} />
          <div className="mt-5 border-t border-border pt-4">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}
