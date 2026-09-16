// scripts/check-root-layout.mjs
//
// WHY THIS FILE EXISTS
// ====================
// Three separate times now, src/app/layout.tsx (the ROOT layout, the one
// that must contain <html> and <body>) has ended up with the WRONG
// content in it - a duplicate of src/app/(public)/layout.tsx (the header
// and footer wrapper) instead. Both files are named "layout.tsx", which
// makes them very easy to confuse in an editor, especially across two
// tabs that show the same file name.
//
// Every time this happened, the symptom was identical: a "Missing <html>
// and <body> tags in the root layout" runtime error locally, and a
// completely unstyled site if deployed, because the file that's supposed
// to import globals.css no longer does.
//
// Rather than rely on catching this by eye after it breaks again, this
// script checks the actual file content automatically, every single time
// "npm run dev" or "npm run build" is used - see the "predev" and
// "prebuild" entries in package.json, which make npm run this
// automatically before the real command, with no extra typing required.
//
// If the file is wrong, this script prints a loud, specific error and
// stops the command before Next.js even starts - so instead of a
// confusing runtime error in the browser, you get a clear message in the
// terminal telling you exactly what's wrong and how to fix it.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootLayoutPath = join(__dirname, "..", "src", "app", "layout.tsx");

function fail(message) {
  console.error("\n\x1b[41m\x1b[37m FIX NEEDED BEFORE THIS WILL RUN \x1b[0m\n");
  console.error(message);
  console.error(
    "\nFull correct content for src/app/layout.tsx is in docs/TROUBLESHOOTING.md, " +
      "under 'Root layout keeps breaking'. Paste it in, save, and run this command again.\n",
  );
  process.exit(1);
}

if (!existsSync(rootLayoutPath)) {
  fail(`src/app/layout.tsx does not exist at all. This file is required.`);
}

const content = readFileSync(rootLayoutPath, "utf-8");

const hasHtmlTag = content.includes("<html");
const hasBodyTag = content.includes("<body");
const importsGlobalsCss = content.includes('"./globals.css"');
const looksLikePublicLayoutInstead =
  content.includes("PublicLayout") ||
  (content.includes("<Header") && content.includes("<Footer"));

if (looksLikePublicLayoutInstead) {
  fail(
    "src/app/layout.tsx currently contains the PUBLIC layout's content " +
      "(the header/footer wrapper) instead of its own. This is the exact " +
      "bug that has broken the site before - the two layout.tsx files got " +
      "swapped, probably by pasting into the wrong VS Code tab.",
  );
}

if (!hasHtmlTag || !hasBodyTag || !importsGlobalsCss) {
  fail(
    "src/app/layout.tsx is missing something it must always have: " +
      (!hasHtmlTag ? "an <html> tag, " : "") +
      (!hasBodyTag ? "a <body> tag, " : "") +
      (!importsGlobalsCss ? 'the import "./globals.css" line, ' : "") +
      "this is the file that provides the page's basic HTML structure and CSS.",
  );
}

console.log("✓ Root layout check passed - src/app/layout.tsx looks correct.");
