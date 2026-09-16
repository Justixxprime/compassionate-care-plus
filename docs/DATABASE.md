# DATABASE

How the database is set up, why it's structured this way, and exactly how to get it running on my Windows machine.

## What I'm using and why

**PostgreSQL** - a real, production-grade relational database. Free, runs locally on my machine during development, and it's what production would use too, so nothing changes shape later.

**Prisma** - the tool that lets me describe my database as a readable file (`prisma/schema.prisma`) instead of writing raw SQL by hand, and that turns that description into real tables through something called a migration. It also gives me **Prisma Studio**, a visual browser for my own data, which matters a lot while I'm still learning how the data is shaped.

## An honest limitation from building this

I couldn't run any Prisma commands myself while building this (`generate`, `migrate`, `studio`) - Prisma needs to download an engine file from `binaries.prisma.sh`, and that address isn't reachable from where I do my work. So I wrote `prisma/schema.prisma` by hand rather than having Prisma generate or check it for me. This isn't unusual though - the actual first migration always has to run on *my* machine anyway, since only my machine can see my local database. The steps below are exact and I'm confident in them, but this phase is the first one where "it builds cleanly for me" doesn't mean much - it only really counts once it runs successfully on my computer.

## Step 1 - Install PostgreSQL

1. Go to <https://www.postgresql.org/download/windows/>
2. Click the "Download the installer" link (this goes to EnterpriseDB's installer).
3. Download the latest version (17.x is fine).
4. Run the installer.
5. Click through the setup wizard. Keep every default **except**:
   - When it asks for a **password for the postgres superuser**, pick one and **write it down somewhere safe**. I will need it in a moment.
6. Keep the default port: **5432**.
7. When it asks about "Stack Builder" at the end, I can skip it - I don't need extra tools right now.
8. Finish the installer.

**What I should see:** the installer finishes with no errors, and I now have a program called **pgAdmin 4** in my Start menu - it was installed alongside PostgreSQL.

## Step 2 - Create the database using pgAdmin

1. Open **pgAdmin 4** from the Start menu. It opens in a browser-like window.
2. It will ask for a **master password** the first time - this is for pgAdmin itself, not PostgreSQL. Pick anything and remember it.
3. In the left sidebar, expand **Servers → PostgreSQL 17**.
4. It will ask for the **postgres user's password** - this is the one I wrote down in Step 1.
5. Right-click on **Databases**, then **Create → Database...**
6. Name it `cheliv_dev`.
7. Click **Save**.

**What I should see:** `cheliv_dev` now appears under Databases in the left sidebar.

## Step 3 - Build the connection string

This is the single value Prisma needs to find my database. The shape is:

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

For a fresh local install, that becomes:

```
postgresql://postgres:MY_PASSWORD_HERE@localhost:5432/cheliv_dev
```

Replace `MY_PASSWORD_HERE` with the postgres password from Step 1. If the password has special characters like `@` or `/` in it, those need to be "URL encoded" - if this happens, tell me the character and I'll give the encoded version, or it's simplest to just set a password without special characters for local development.

## Step 4 - Create my `.env` file

Prisma reads its database connection from a file literally named `.env` at the project root - not `.env.local` (that one's for Next.js specifically, and Next.js will also read `.env`, so one file covers both).

1. In the project folder, find `.env.example`.
2. Copy it and rename the copy to exactly `.env`.
3. Open `.env` and replace the `DATABASE_URL` line with my real connection string from Step 3.
4. Save it.

**Check:** `.env` should never show up when I run `git status` - if it does, something is wrong with `.gitignore` and I stop before committing anything.

## Step 5 - Run the first migration

Back in the terminal, inside the project folder:

```bash
npx prisma migrate dev --name init
```

**What this does:** Prisma reads `prisma/schema.prisma`, works out the SQL needed to create every table described in it, runs that SQL against my `cheliv_dev` database, and saves a record of what it did in `prisma/migrations/`. This is also the first command that will actually download Prisma's engine files - it needs real internet access, which my machine has (this is the thing I couldn't do myself).

**What I should see:** a series of messages ending in something like:

```
Your database is now in sync with your schema.
✔ Generated Prisma Client
```

## Step 6 - Seed the database

```bash
npx prisma db seed
```

**What this does:** runs `prisma/seed.ts`, which creates the organization row, the full permission list, the roles, and one demo admin account.

**What I should see:**

```
Seeding database...
Organization ready: Cheliv Compassionate Care Plus Inc
30 permissions ready
9 roles ready
Demo admin ready: demo.admin@cheliv.test
Seed complete.
```

## Step 7 - Look at the data

```bash
npx prisma studio
```

**What this does:** opens a browser tab at `http://localhost:5555` showing every table and every row, in a spreadsheet-like view I can click through.

**What I should see:** clicking `Organization` shows one row - Cheliv Compassionate Care Plus Inc. Clicking `User` shows one row - the demo admin. Clicking `Role` shows nine rows.

That confirms the whole chain worked: schema → migration → real tables → seeded data → visible in Studio.

## The demo admin account

- Email: `demo.admin@cheliv.test`
- Password: `ChangeMe123!`

This is a development-only account with an intentionally simple, documented password - never a real credential, never used anywhere but my own machine during development.

## What's in the schema right now, and what isn't yet

**Built this phase:** organizations, users, sessions, roles, permissions, and the two join tables connecting them.

**Not built yet, on purpose:** patients, visits, care plans, documents, and everything else clinical. Building those now, before authentication actually works end to end, would mean testing none of it for weeks - see `PHASE_0_ARCHITECTURE.md` section 2, "do not build everything at once." Those come in Milestone D.

## If something goes wrong

**"Can't reach database server"** - PostgreSQL isn't running, or the connection string is wrong. Open pgAdmin - if it can't connect either, the PostgreSQL service itself may need starting (search Windows for "Services", find "postgresql-x64-17", make sure it says "Running").

**"password authentication failed"** - the password in `.env` doesn't match what I set in Step 1. I can reset it via pgAdmin if I've forgotten it.

**"database does not exist"** - the database name in the connection string doesn't match what I created in pgAdmin. Check for typos, `cheliv_dev` should match exactly.

**Prisma commands hang or fail to download something** - this is the one step that genuinely needs a good internet connection, since it's downloading Prisma's engine files. Try again, or check if something on the network (a VPN, a firewall) is blocking it.
