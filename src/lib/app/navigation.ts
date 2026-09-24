// src/lib/app/navigation.ts
//
// The menu of the internal app, decided from what the signed-in person
// really holds. Pure: no database, no "server-only", so the test script can
// call it directly and a screen never has to guess.
//
// The rule: an item appears only when the account holds the permission the
// page behind it needs. The server works this out from the database
// (src/lib/app/access.ts) and hands the browser only the finished list, so
// the browser never receives a link the person may not use.
//
// A menu link is a convenience, not a lock. Hiding a link never protects
// anything: every page and every action re-checks permission and reach on
// the server (docs/APP_SHELL.md).

export type NavIconKey =
  | "home"
  | "patients"
  | "today"
  | "myCare"
  | "family"
  | "consents"
  | "visits"
  | "schedule"
  | "carePlans"
  | "tasks"
  | "referrals"
  | "documents"
  | "staff"
  | "auditLog";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  // The permission the page behind this link needs, or null for "any
  // signed-in account" (the dashboard).
  requires: string | null;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Every item that can ever appear, in the order it appears.
export const NAV_DEFINITION: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "home", requires: null }],
  },
  {
    label: "Care",
    items: [
      { href: "/my-care", label: "My care", icon: "myCare", requires: "portal.read" },
      { href: "/family", label: "Shared with me", icon: "family", requires: "family.read" },
      { href: "/caregiver", label: "My day", icon: "today", requires: "visits.checkin" },
      { href: "/patients", label: "Patients", icon: "patients", requires: "patients.read" },
      { href: "/visits", label: "Visits", icon: "visits", requires: "visits.read" },
      { href: "/schedule", label: "Scheduling board", icon: "schedule", requires: "visits.read" },
      { href: "/care-plans", label: "Care plans", icon: "carePlans", requires: "care_plans.read" },
      { href: "/tasks", label: "Tasks", icon: "tasks", requires: "tasks.read" },
    ],
  },
  {
    label: "Office",
    items: [
      { href: "/referrals", label: "Referrals", icon: "referrals", requires: "referrals.read" },
      { href: "/documents", label: "Documents", icon: "documents", requires: "documents.read" },
      { href: "/consents", label: "Family access", icon: "consents", requires: "consents.manage" },
      { href: "/staff", label: "Staff", icon: "staff", requires: "staff.manage" },
      { href: "/audit-log", label: "Audit log", icon: "auditLog", requires: "audit.read" },
    ],
  },
];

// The menu for one account. A group with nothing in it is left out, so a
// nurse never sees an empty "Office" heading.
export function buildNavigation(permissions: ReadonlySet<string>): NavGroup[] {
  return NAV_DEFINITION.map((group) => ({
    label: group.label,
    items: group.items.filter(
      (item) => item.requires === null || permissions.has(item.requires),
    ),
  })).filter((group) => group.items.length > 0);
}

// Every link in a menu, flattened. The test script uses it.
export function navHrefs(groups: readonly NavGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.href));
}

// Is this menu item the page the person is on? "/visits" is current on
// "/visits" and on anything below it, such as "/visits/123".
export function isCurrentPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
