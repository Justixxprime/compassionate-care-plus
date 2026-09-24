import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { getRequestPermissions, requireUser } from "@/lib/app/access";
import { buildNavigation } from "@/lib/app/navigation";
import { getUnreadNotificationCount } from "@/lib/notifications";

// Every page under app/(app)/ renders inside this. The route group (the
// parentheses in the folder name) adds nothing to the URL, so
// app/(app)/visits/page.tsx is still just "/visits".
//
// THIS IS THE INTERNAL APP'S LAYOUT. It is a different file from the two
// others named layout.tsx:
//   src/app/layout.tsx          the ROOT layout: the html and body tags, globals.css
//   src/app/(public)/layout.tsx the public website's header and footer
//   src/app/(app)/layout.tsx    this file: the staff shell (sidebar, menu)
// This one must NOT contain the html or body tags (only the root layout may).
// scripts/check-root-layout.mjs checks all three every time you run
// npm run dev or npm run build.
//
// The layout asks who is signed in so it can draw the menu. That is NOT the
// security check: Next.js keeps a layout on screen while you move between
// pages, so it does not run again on every click. Every page.tsx below
// calls requireUser() itself and every service re-checks permission and
// reach (src/lib/app/access.ts, docs/APP_SHELL.md).

export const metadata: Metadata = {
  title: { default: "Staff", template: "%s | Cheliv Staff" },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permissions = await getRequestPermissions(user.id);
  // Only a count, for the bell. Never anything about what the notices say.
  const unreadCount = await getUnreadNotificationCount(user.id);

  const roleLabel =
    user.userRoles.map((ur: { role: { name: string } }) => ur.role.name).join(", ") ||
    "No role assigned";

  return (
    <AppShell
      userName={user.name}
      roleLabel={roleLabel}
      groups={buildNavigation(permissions)}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
