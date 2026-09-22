// src/lib/app/access.ts
//
// How a page of the internal app finds out who is looking at it, once per
// request, and turns them away when nobody is.
//
// WHY EVERY PAGE CALLS THIS, EVEN THOUGH THE SHELL DOES TOO
// The shared layout (src/app/(app)/layout.tsx) also asks who is signed in.
// That is for drawing the navigation, and it is NOT the security check.
// Next.js keeps a layout on screen while you move between pages inside it,
// so a layout does not run again on every click (docs/APP_SHELL.md explains
// this in plain words, and the Next.js authentication guide warns about it).
// So every page.tsx under src/app/(app) calls requireUser() itself, and
// every service it then calls re-checks permission and reach. The test
// script (npm run verify:shell) reads every page file and fails if one of
// them forgets.
//
// React's cache() makes the layout and the page share ONE database lookup
// per request instead of doing the same lookup twice.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserPermissions } from "@/lib/auth/authorize";

// The signed-in person (with their roles), or null. One lookup per request.
export const getRequestUser = cache(getCurrentUser);

export type StaffUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Every page calls this first. Nobody signed in means a redirect to the
// sign-in page, decided here on the server, not by anything in the browser.
export async function requireUser(): Promise<StaffUser> {
  const user = await getRequestUser();
  if (!user) redirect("/sign-in");
  return user;
}

// Every permission this person holds, as a set. One lookup per request and
// person. Used to draw the navigation and to decide which dashboard
// sections exist. The services still call requirePermission themselves.
export const getRequestPermissions = cache(
  async (userId: string): Promise<ReadonlySet<string>> =>
    new Set(await getUserPermissions(userId)),
);

// The keys of the roles this person holds, for example ["NURSE"].
export function roleKeysOf(user: StaffUser): string[] {
  return user.userRoles.map((ur) => ur.role.key);
}
