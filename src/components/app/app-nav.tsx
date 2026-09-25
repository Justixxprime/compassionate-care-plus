"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileText,
  HeartHandshake,
  HeartPulse,
  History,
  Inbox,
  LayoutDashboard,
  Mail,
  Menu,
  ShieldCheck,
  UserCog,
  Users,
  X,
  ListChecks,
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

  THE PHONE PANEL IS A NATIVE <dialog>, NOT A STYLED <div>.
  A styled div plus a backdrop div plus z-index is a CSS trick, and a
  trick can be defeated: a future component with its own z-index, a
  stacking context created by something as ordinary as a `sticky`
  header, or one dropped `pointer-events-none` class, and the "backdrop"
  quietly stops blocking taps. That is exactly the shape of bug that was
  reported (a field behind the open menu still being reachable). A real
  <dialog>, opened with showModal(), does not have that failure mode: the
  browser itself puts it in the page's "top layer", above absolutely
  everything else, and makes its own backdrop the only thing behind it
  that a tap can reach. There is no CSS to get wrong. Escape and the
  backdrop tap are native browser behavior too, not hand-rolled listeners.

  Closing still does not rely only on each link's onClick, for the
  reason explained where it happens below: the shell around this
  (src/app/(app)/layout.tsx) is a Server Component that can legitimately
  re-run on navigation, and exactly when a Client Component underneath
  it keeps or loses state is an implementation detail, not a guarantee.
  So the panel also watches the current path directly and closes itself
  the instant the path changes, for ANY reason - a nav-item click, the
  browser back button, anything.
*/

const ICONS: Record<NavIconKey, LucideIcon> = {
  home: LayoutDashboard,
  patients: Users,
  today: CalendarCheck,
  myCare: HeartPulse,
  family: HeartHandshake,
  consents: ShieldCheck,
  visits: CalendarDays,
  schedule: CalendarRange,
  carePlans: ClipboardList,
  tasks: ListChecks,
  referrals: Inbox,
  documents: FileText,
  staff: UserCog,
  careRequests: Mail,
  auditLog: History,
};

function NavList({
  groups,
  onNavigate,
  density,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
  // Two densities sharing one set of rules. "sidebar" keeps the desktop
  // rail information-dense - it sits on screen all day, next to real
  // work. "drawer" gives the phone panel real air: it briefly takes over
  // the whole screen, so it is allowed to feel calm rather than packed.
  density: "sidebar" | "drawer";
}) {
  const pathname = usePathname();
  const drawer = density === "drawer";

  return (
    <nav aria-label="Main" className={drawer ? "space-y-9" : "space-y-7"}>
      {groups.map((group) => (
        <div key={group.label} className={drawer ? "space-y-3.5" : "space-y-2.5"}>
          <p className="px-3 text-caption font-semibold uppercase tracking-widest text-slate/80">
            {group.label}
          </p>
          <ul className={drawer ? "space-y-2" : "space-y-1"}>
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
                      "flex items-center rounded-lg border-l-[3px] font-medium transition-colors duration-150",
                      drawer
                        ? "min-h-12 gap-3.5 px-4 py-3 text-body"
                        : "min-h-11 gap-3 px-3.5 py-2.5 text-body-sm",
                      current
                        ? "border-pine bg-sage font-semibold text-pine-dark"
                        : "border-transparent text-ink hover:bg-sage/60",
                    )}
                  >
                    <Icon
                      className={cn(
                        "flex-none",
                        drawer ? "h-5 w-5" : "h-[1.125rem] w-[1.125rem]",
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
  return <NavList groups={groups} density="sidebar" />;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // `open` is the one source of truth. This effect is the only place
  // that ever calls showModal()/close() on the element, so the React
  // state and the real DOM dialog can never quietly disagree.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The browser can close the dialog on its own (Escape). When it does,
  // it fires "close" on the element - listen for that and bring the
  // React state back in sync, instead of trusting only our own buttons.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  // The one guaranteed close-on-navigate: whenever the visible page
  // changes for any reason, shut the panel. This adjusts state during
  // render rather than in an effect (React's own recommended pattern for
  // "reset something when a value changes"), so it can't race with, or
  // get skipped by, whatever else is happening on navigation.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    if (open) setOpen(false);
  }

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
        aria-haspopup="dialog"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-border-strong bg-white"
      >
        <Menu className="h-5 w-5 text-ink" aria-hidden="true" />
      </button>

      {/* A native dialog. Tapping its own backdrop (the dimmed area the
          browser itself draws) fires a click whose target is the dialog
          element itself, because nothing else was under the tap - that
          is how a plain click here is told apart from a click on
          anything inside the panel, with no extra wrapper element. */}
      <dialog
        ref={dialogRef}
        aria-label="Main menu"
        className="app-drawer border-l border-border shadow-raised"
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
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

        <div className="flex-1 overflow-y-auto px-5 py-8">
          <NavList
            groups={groups}
            onNavigate={() => setOpen(false)}
            density="drawer"
          />
        </div>

        <div className="flex-none border-t border-border px-6 py-6">
          {footer}
        </div>
      </dialog>
    </div>
  );
}
