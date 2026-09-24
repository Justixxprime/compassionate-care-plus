# DEPLOYMENT.md

**Last updated:** 24 September 2026

## In plain words

There are two copies of this project running, and they are not the same machine.

1. **Your laptop** (`localhost:3000`): the website AND the database live on your computer, so sign-in and every internal screen work.
2. **The live site on Vercel** (`compassionate-care-plus.vercel.app`): the website is there, but the database is not. Your database is a program on your laptop. Vercel cannot see your laptop, and your `.env` file (which holds the database address and is never uploaded, on purpose) is not there either.

So on Vercel the public pages work (they need no database) and the internal portal cannot.

## What the live site shows now (option 1, free)

`/sign-in` shows "The secure portal is not open here yet" with buttons for Request care and Back to the website. `/dashboard` and every other internal address send a visitor without a session to `/sign-in`, so they see the same screen. Nothing is exposed, because there is nothing behind it.

The screen appears when any of these is true: no `DATABASE_URL` is set, the database cannot be reached, or its tables do not exist. One limit: someone who already holds a session cookie while the database is down sees the app's own error screen on internal pages, not this one. Any other error is not hidden (it still shows and is logged), so a real bug is never disguised. The code is `src/lib/app/portal-availability.ts` and `src/components/app/portal-closed.tsx`.

`/design-system` (the internal style page) is "not found" on the live site.

## Showing the internal app to someone

Screen-share or sit next to your laptop with `npm run dev` running. Sign in with the demo accounts (the same ones you already use, for example demo.admin@cheliv.test).

## If you later want the portal online (option 2, needs your decision)

This costs nothing on some free plans and money on others (check the provider's current terms), so it is your decision. It also puts a login page on the internet.

1. Create a hosted Postgres database (Neon, Supabase or Vercel's own storage).
2. In Vercel, Project Settings, Environment Variables: add `DATABASE_URL` with the provider's **pooled** address. Serverless pages open many short connections, and a pooled address prevents "too many connections".
3. On your laptop, in a PowerShell window, set the provider's **direct** address for this window only, then run `npx prisma migrate deploy`. Close the window afterwards. Never run `migrate dev` or a reset against the hosted database.
4. Redeploy (Deployments, Redeploy). Changing a variable does not change an old deployment.
5. Do NOT run the seed against it: the seed now refuses (it would create accounts with a known password). Create real accounts by another route; the "create staff account" flow is still an open item.

Before doing this, decide how the login page is protected, and whether the repo stays public (see `REVIEW_MILESTONE_D.md` item 4).

## Still not wired: the Request care form

The form on `/request-care` shows "Request received", but nothing is sent or saved anywhere (there is no place for it to go on a site with no database or e-mail service). Before real visitors use the live site this needs a decision: save requests to a hosted database, or send them to an office e-mail address.
