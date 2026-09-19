// scripts/stubs/server-only.ts
//
// Only used by command-line scripts (like scripts/verify-access.ts) that
// import server code OUTSIDE of Next.js. Inside the real app, Next.js
// provides its own "server-only" guard, which is what protects against
// a Client Component importing server code. A standalone script has no
// Next.js around it, so this empty stand-in lets those imports resolve.
// The real app never uses this file (see tsconfig.scripts.json, which
// only scripts use).
export {};
