# TROUBLESHOOTING

Things that go wrong and what I do about them. I add to this file every time something bites me.

## "node is not recognized as an internal or external command"

Node.js is either not installed, or the terminal was opened before it was installed.

1. Install the LTS version from <https://nodejs.org>.
2. Close VS Code **completely**.
3. Reopen it and try `node -v` again.

## "npm install" fails or hangs

- Check internet.
- Some school, office and public networks block npm. Try another network.
- Antivirus sometimes locks files mid-install. Delete the `node_modules` folder and `package-lock.json`, then run `npm install` again.

## "Port 3000 is already in use"

Something else is using it - often a dev server I forgot to stop.

```bash
npm run dev -- -p 3001
```

Then use <http://localhost:3001>.

## The browser shows an old version of my page

1. Stop the server with `Ctrl + C`.
2. Delete the `.next` folder.
3. Run `npm run dev` again.
4. Hard refresh the browser: `Ctrl + Shift + R`.

## Red squiggly lines everywhere in VS Code, but the site works

The TypeScript server got confused. Press `Ctrl + Shift + P`, type "TypeScript: Restart TS Server", press Enter.

## "Module not found: Can't resolve '@/components/...'"

Either the file does not exist at that path, or the capitalization is different. Windows does not care about capital letters in filenames but the build server does - `Button.tsx` and `button.tsx` are different files as far as deployment is concerned. I keep filenames consistent.

## git says "fatal: not a git repository"

I am in the wrong folder. Run `cd C:\dev\compassionate-care-plus` and try again.

## git push rejected

Someone (or another machine) changed the remote. Run `git pull --rebase`, resolve anything it flags, then push again. I never use `git push --force` without understanding exactly what it will destroy.

## I broke something and I do not know what

```bash
git status          # what changed?
git diff            # what exactly changed inside those files?
git restore <file>  # throw away my changes to one file
```

This is the whole reason I commit often.

## Root layout keeps breaking ("Missing html and body tags" / totally unstyled site)

This has happened three times now, always the same cause: `src/app/layout.tsx` (the ROOT layout) gets the wrong content pasted into it - a duplicate of `src/app/(public)/layout.tsx` (the header/footer wrapper). Both files are named `layout.tsx`, which makes them very easy to confuse across two VS Code tabs.

**As of this fix, this can't fail silently anymore.** `npm run dev` and `npm run build` now automatically check this file first, before starting anything else. If it's wrong, you'll see a clear red error in the terminal telling you exactly what's wrong, instead of a confusing runtime error in the browser later. Run `npm run checklayout` any time to check it manually.

If you see that error, here is the correct, complete content for `src/app/layout.tsx`. Open the file, select all (`Ctrl+A`), delete, paste this, save:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cheliv Compassionate Care Plus",
  description:
    "Cheliv Compassionate Care Plus Inc. Home health care serving Texas.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-white text-neutral-900">
        <noscript>
          <style>{`.reveal { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
```

**How to tell the two files apart going forward:** look at the VS Code tab or the breadcrumb at the top of the editor, not just the file name.
- `src/app/layout.tsx` (no parentheses in the path) - the ROOT layout. Must have `<html>` and `<body>`.
- `src/app/(public)/layout.tsx` (has `(public)` in the path) - the PUBLIC SITE layout. Has the header, footer, and `<main>` - no `<html>` or `<body>`.

If you're ever about to paste into a `layout.tsx` file, check the breadcrumb path first.

## verify:access says "Refusing to run"

`npm run verify:access` only runs when `DATABASE_URL` points at your own machine (localhost). It creates and deletes rows to test the access rules, so it must never touch anything real. If your `.env` points at localhost and you still see this, check the URL has `@localhost:` in it.

## verify:access says the demo accounts are missing

Run `npx prisma db seed` first. It needs `demo.admin`, `demo.nurse` and `demo.nurse2`.

## verify:access reports "CLEANUP FAILED"

Open Prisma Studio (`npx prisma studio`) and delete any patient whose last name starts with `Testpatient`, and any user whose email starts with `verify-`. Then run it again.

## /visits shows no visits after the seed

The seed only creates demo visits when the organization has none. If old visits exist, it leaves them alone. To refresh the demo dates, delete the rows in the `visits` table in Prisma Studio and run `npx prisma db seed` again.

## A red "1 Issue" badge in the corner of the page while developing

Click the badge to read it. If it mentions attributes on `<body>` that "didn't match" (for example `cz-shortcut-listen` from ColorZilla, or `data-gr-ext-installed` from Grammarly), it is a browser extension editing the page before React finished, not a bug in the project. `src/app/layout.tsx` now has `suppressHydrationWarning` on `<body>`, which silences exactly that. If the badge still shows after that, it is something else, so click it and read what it says.

## A "coming soon" or "placeholder" file survives after a zip

Zip files add and overwrite files but never delete. If an old file was removed from the project (for example `src/components/marketing/coming-soon-page.tsx`), delete it yourself: `Remove-Item src\components\marketing\coming-soon-page.tsx`.
