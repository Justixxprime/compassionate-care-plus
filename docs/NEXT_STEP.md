# NEXT_STEP.md

**Last updated:** 22 September 2026
**Just finished:** found and fixed the real cause of the phone menu bug (ccp-e4-drawer-fix reported back as still broken). Did not start E2 yet, on purpose, see below.

---

## What was wrong (plain language)

The phone menu is a native `<dialog>` element. Browsers already know how to
hide a `<dialog>` when it is closed and show it when it is open, for free,
with no code needed for that part.

The menu's box also needed to be a column (header on top, links in the
middle, account info at the bottom), so the last round added Tailwind's
`flex flex-col` classes to it. That was the mistake: those classes tell the
browser "always show this as a column box", with no exception for
"unless it's closed". Your own styling always wins over the browser's
built-in styling, so from that point on the menu box never actually
went away when closed. It only ever slid sideways, just past the right
edge of the screen. Still a full-height, full-width-ish box, still sitting
there, still counted when the browser works out how big the page is,
still reachable by keyboard, just pushed a bit further right than the
visible screen.

That explains everything you saw: a page that measures "too big", a
second "Cheliv" panel that never goes away, and a menu that looks like it
closes (it slides away) but never truly does.

## The fix

`display: none` / `display: flex` now live only in `globals.css`, tied to
whether the dialog is open, exactly the way the dialog already worked
before those two Tailwind classes were added to it. Closed now means
gone, the way it did before, and the way the rest of the code already
assumed it did. Two files touched: `src/app/globals.css`,
`src/components/app/app-nav.tsx` (just removed the two classes from the
dialog's className, the box's own shape now comes entirely from
`.app-drawer` in the CSS file).

No schema change, no new dependency, no migration.

## NOT starting E2 yet, on purpose

Last round's instructions said to wait for your confirmation that the
menu holds before starting the Care Command Center. That menu did not
hold, so by that same rule E2 is still on hold, this time until you
confirm the ACTUAL bug (the page getting bigger, the second panel that
would not go away) is gone too, not just the tap-through problem from
before. Continuing to build on top of a shell that is still visibly
broken risked compounding the confusion instead of fixing it.

## ASK ME ONLY THIS (once)

On your phone (or a narrow browser window): open the menu, then close it
by X, by tapping outside it, and by Escape. Each time, check that:

1. The page does not feel like it grew, and there is no sideways scroll.
2. Nothing "Cheliv"-shaped is left showing anywhere once it is closed.
3. The Patient dropdown on the Visits page (where this started) is
   fully reachable again once the menu is closed, every time.

If all three hold: say so, and E2 (the Care Command Center) starts right
away, no more screenshots needed first.

## What was tested, and what was not

The two changed files were read back after editing and the CSS change
matches the same `display: none` / `[open] { display: flex }` pattern
already used for this exact dialog's own `::backdrop` a few lines below
it in the same file, so it is consistent with code already in the
project, not a new pattern. Full lint, type-check and Tailwind build
were not run this round (asked to package and present the fix first
rather than spend extra tool calls on that); worth running
`npm run dev` and watching the terminal for errors as the first check
on your end, before the phone test above.

## Everything else from before is unchanged and still true

Milestones A to D done. E0 to E1.2 done and confirmed. Six old folders
already deleted (you did this earlier). The `document_access_grants`
migration and seed are already applied on your machine. Next after E2
confirmation: E3 clinical portal, E4 caregiver portal, E5 patient and
family portals. Open decisions list is unchanged, see
`docs/REVIEW_MILESTONE_D.md`.

## Exact next commands after you have tested

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npm run dev
```

No migration this round, so no `npx prisma migrate dev` needed. If step 3
in the phone test above passes, then:

```powershell
npm run verify:access
npm run verify:shell
git add .
git commit -m "Fix phone menu staying rendered when closed (display was locked to flex)"
git push
```
