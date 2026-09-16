# ENVIRONMENT VARIABLES

Settings that change between my laptop and a real server live here instead of being typed into the code. That way a password never ends up inside a file that goes to GitHub.

## How this works

- `.env.example` is committed. It lists the names of every setting, with fake or empty values. It is the map.
- `.env.local` is **never** committed. It holds my real values. `.gitignore` blocks it.

To set up:

1. Copy `.env.example`.
2. Rename the copy to `.env.local`.
3. Fill in the values.

## The rule about NEXT_PUBLIC_

Any variable whose name starts with `NEXT_PUBLIC_` is **shipped to the browser**. Anyone visiting the site can read it. Everything else stays on the server.

So: `NEXT_PUBLIC_` is for things that are not secret. A database password with `NEXT_PUBLIC_` in front of it is a data breach, not a typo.

## Current variables

| Name | What it does | Where it comes from | Secret? | Safe in browser? |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | The address the app runs at. Used for links and redirects. | `http://localhost:3000` in development | No | Yes |
| `NEXT_PUBLIC_DEMO_MODE` | When `true`, the app uses synthetic data and shows a "Demonstration data" indicator. Stays `true` for all of development. | Set by me | No | Yes |

## Variables coming in later phases

Listed early so I am not surprised.

| Name | Phase | Secret? | Notes |
|---|---|---|---|
| `DATABASE_URL` | Database | **Yes** | Contains a username and password. Server only, always. |
| `AUTH_SECRET` | Authentication | **Yes** | Signs session cookies. Generated with `openssl rand -base64 32`. A different value in every environment. |
| `EMAIL_SERVER_HOST` | Notifications | No | Points at a local mail catcher during development, so no email leaves my machine. |
| `S3_BUCKET` / `AWS_*` | Cloud | **Yes** | Only exists in production, only in AWS Secrets Manager. |

## If I ever commit a secret by accident

1. Treat it as leaked. Do not just delete the line — it stays in Git history.
2. Rotate it immediately: change the password, regenerate the key.
3. Then clean the history, or in the worst case start a fresh repository.

This is much easier to avoid than to fix, which is why `.env*` is in `.gitignore` from the very first commit.

## DATABASE_URL (added this phase)

The connection string Prisma uses to find the local PostgreSQL database. Shape: `postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME`.

**Secret.** Contains a real password. Never goes to the browser, never gets committed.

**Where it comes from:** set when PostgreSQL is installed locally - see `docs/DATABASE.md` for the exact steps to get this value.

**Important:** this one goes in a file literally named `.env` at the project root, not `.env.local`. Prisma's own tooling reads `.env` by default; Next.js reads both, so one file covers everything.
