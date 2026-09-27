# Database Migrations

## Why this is separate from Vercel builds

Vercel can build more than one deployment at the same time. Prisma migrations take a database advisory lock so only one migration changes the database at a time. Running migrations inside every Vercel build can make a healthy deployment fail while it waits for that lock.

For that reason, `npm run build` now builds the website only. The separate command below applies pending migrations once, deliberately.

## When to run a migration

Run this only after a future code update adds a new folder inside `prisma/migrations/`. Do not run it for ordinary design, text, or page updates.

## Safe steps

1. Make sure the new code is already pushed to GitHub.
2. Open the project folder in PowerShell.
3. Run:

```powershell
npm run db:deploy
```

4. Wait for the words `No pending migrations to apply` or a message confirming migrations were applied.
5. Then allow Vercel to deploy the matching code.

## Never use these against Neon production

```powershell
npx prisma migrate dev
npx prisma migrate reset
```

Those commands are for local development and can change or erase data. Production uses only `npm run db:deploy`.

## If Prisma says it is waiting for an advisory lock

1. Wait a few minutes. Another deployment or migration may already be finishing.
2. Do not start several more migration commands.
3. Check the Vercel deployment list for an active build.
4. Run `npm run db:deploy` only once after the other operation finishes.
5. If it continues, use the incident plan and inspect Neon with the organization owner. Do not force-unlock the database unless a qualified database administrator has confirmed the owner of the lock.

