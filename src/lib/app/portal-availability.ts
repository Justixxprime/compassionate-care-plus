// src/lib/app/portal-availability.ts
//
// Is the secure portal actually available on THIS website right now?
//
// WHY THIS FILE EXISTS
// The public pages (home, services, contact) need no database. The portal
// (sign-in, dashboard and everything behind it) does. On a website that has
// no database attached, for example the Vercel demo site while the database
// only lives on my laptop, the sign-in page used to crash with a raw
// "This page couldn't load" server error. A visitor should instead see a
// calm, honest screen (src/components/app/portal-closed.tsx).
//
// Two questions are answered here, and neither one ever changes who may see
// what. This file decides only WHICH SCREEN to draw when the database
// cannot be used. It never lets anybody in.
//
//   1. portalDatabaseConfigured()   is a database address set at all?
//   2. isPortalUnavailableError()   did a database call fail because the
//                                   database could not be reached, or
//                                   because its tables do not exist yet?
//
// Any other kind of error is a real bug and is NOT hidden: the caller
// re-throws it so it still shows up in the logs.

import "server-only";
import { Prisma } from "@prisma/client";

export function portalDatabaseConfigured(): boolean {
  return (process.env.DATABASE_URL ?? "").trim().length > 0;
}

// Prisma error codes that mean "this database cannot be used for the portal",
// not "the code is wrong":
//   P1001 cannot reach the database server   P1002 the server timed out
//   P1003 the database does not exist        P1008 an operation timed out
//   P1017 the server closed the connection
//   P2021 a table does not exist             P2022 a column does not exist
// Depending on how Prisma talks to the database, an unreachable server is
// reported as an "initialization" error or as a "known request" error with
// one of the P1xxx codes, so both shapes are recognised.
const UNAVAILABLE_CODES = new Set([
  "P1001",
  "P1002",
  "P1003",
  "P1008",
  "P1017",
  "P2021",
  "P2022",
]);

export function isPortalUnavailableError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    UNAVAILABLE_CODES.has(err.code)
  ) {
    return true;
  }
  return false;
}
