// src/lib/prisma.ts
//
// One shared Prisma Client for the whole app. Without this, Next.js's
// dev server hot-reloading would create a brand new PrismaClient (and a
// brand new pool of database connections) on almost every file save,
// and PostgreSQL only allows so many open connections before it starts
// rejecting new ones.
//
// The pattern: stash the client on the global object in development so
// hot reloads reuse it, but never do that in production, where there is
// no hot reloading and each server process should just have its own
// client.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}