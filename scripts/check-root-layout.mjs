// scripts/check-root-layout.mjs
//
// WHY THIS FILE EXISTS
// ====================
// There are THREE files named layout.tsx in this project, and they do three
// different jobs:
//
//   src/app/layout.tsx           the ROOT layout. Must contain <html> and
//                                <body> and import globals.css.
//   src/app/(public)/layout.tsx  the public website's header and footer
//                                wrapper. Must NOT contain <html> or <body>.
//   src/app/(app)/layout.tsx     the signed-in staff shell (sidebar, menu).
//                                Must NOT contain <html> or <body>.
//
// Three separate times now, the root layout has ended up holding the WRONG
// content (a copy of the public layout). The files share a name, which
// makes them very easy to confuse in an editor, especially across tabs
// that show the same file name. Every time, the symptom was identical: a
// "Missing <html> and <body> tags in the root layout" error locally, and a
// completely unstyled site if deployed.
//
// Rather than rely on catching this by eye after it breaks again, this
// script checks the actual file content automatically, every single time
// "npm run dev" or "npm run build" is used (see "predev" and "prebuild" in
// package.json).
//
// It also catches a second, quieter mistake. When the staff screens moved
// into src/app/(app)/ (Milestone E1), the old folders at src/app/dashboard,
// patients, visits, care-plans, documents and referrals had to be deleted
// by hand, because unzipping a delivery only adds files and never removes
// them. Two folders that both make the same web address stop Next.js from
// starting with a confusing error. This script says which folders to
// delete instead.
//
// If something is wrong, it prints a loud, specific message and stops the
// command before Next.js even starts.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..", "src", "app");

function fail(message, hint) {
  console.error("\n\x1b[41m\x1b[37m FIX NEEDED BEFORE THIS WILL RUN \x1b[0m\n");
  console.error(message);
  console.error(`\n${hint}\n`);
  process.exit(1);
}

const TROUBLESHOOTING_HINT =
  "Full correct content for each layout file is in docs/TROUBLESHOOTING.md, " +
  "under 'Root layout keeps breaking'. Paste it in, save, and run this command again.";

// ---------- 1. The root layout ----------

const rootLayoutPath = join(appDir, "layout.tsx");

if (!existsSync(rootLayoutPath)) {
  fail("src/app/layout.tsx does not exist at all. This file is required.", TROUBLESHOOTING_HINT);
}

const content = readFileSync(rootLayoutPath, "utf-8");

const hasHtmlTag = content.includes("<html");
const hasBodyTag = content.includes("<body");
const importsGlobalsCss = content.includes('"./globals.css"');
const looksLikePublicLayoutInstead =
  content.includes("PublicLayout") ||
  content.includes("AppLayout") ||
  (content.includes("<Header") && content.includes("<Footer")) ||
  content.includes("<AppShell");

if (looksLikePublicLayoutInstead) {
  fail(
    "src/app/layout.tsx currently contains ANOTHER layout's content " +
      "(the public header/footer wrapper, or the staff shell) instead of its own. " +
      "This is the exact bug that has broken the site before: the layout.tsx " +
      "files got swapped, probably by pasting into the wrong VS Code tab.",
    TROUBLESHOOTING_HINT,
  );
}

if (!hasHtmlTag || !hasBodyTag || !importsGlobalsCss) {
  fail(
    "src/app/layout.tsx is missing something it must always have: " +
      (!hasHtmlTag ? "an <html> tag, " : "") +
      (!hasBodyTag ? "a <body> tag, " : "") +
      (!importsGlobalsCss ? 'the import "./globals.css" line, ' : "") +
      "this is the file that provides the page's basic HTML structure and CSS.",
    TROUBLESHOOTING_HINT,
  );
}

console.log("✓ Root layout check passed - src/app/layout.tsx looks correct.");

// ---------- 2. The two nested layouts ----------

const nested = [
  { path: join(appDir, "(public)", "layout.tsx"), label: "src/app/(public)/layout.tsx", mustHave: "<Header" },
  { path: join(appDir, "(app)", "layout.tsx"), label: "src/app/(app)/layout.tsx", mustHave: "AppShell" },
];

for (const file of nested) {
  if (!existsSync(file.path)) {
    fail(`${file.label} does not exist. This file is required.`, TROUBLESHOOTING_HINT);
  }
  const text = readFileSync(file.path, "utf-8");
  if (text.includes("<html") || text.includes("<body")) {
    fail(
      `${file.label} contains an <html> or <body> tag. Only the ROOT layout ` +
        "(src/app/layout.tsx) may have those. A nested layout with them " +
        "breaks the page. It looks like the root layout's content was pasted here.",
      TROUBLESHOOTING_HINT,
    );
  }
  if (!text.includes(file.mustHave)) {
    fail(
      `${file.label} does not contain ${file.mustHave}, which it must always use. ` +
        "It probably holds another layout's content.",
      TROUBLESHOOTING_HINT,
    );
  }
}

console.log("✓ Nested layout check passed - (public) and (app) layouts look correct.");

// ---------- 3. No screen may exist twice ----------

const movedScreens = ["dashboard", "patients", "visits", "care-plans", "documents", "referrals"];
const leftovers = movedScreens.filter(
  (name) => existsSync(join(appDir, name)) && existsSync(join(appDir, "(app)", name)),
);

if (leftovers.length > 0) {
  const commands = leftovers
    .map((name) => `  Remove-Item -Recurse -Force "src\\app\\${name}"`)
    .join("\n");
  fail(
    "These screens exist TWICE: once in the old place (src/app/<name>) and once " +
      "inside src/app/(app)/<name>. Next.js cannot start with two folders that make " +
      "the same web address. Unzipping a delivery never deletes files, so the old " +
      "copies were left behind. Delete the OLD ones (the ones directly under src/app):\n\n" +
      commands,
    "Run those commands in PowerShell from the project folder, then run this command again.",
  );
}

console.log("✓ Screen folder check passed - no screen exists in two places.");
