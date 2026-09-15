# ULTRA BABY STEPS

This is my build guide. I am writing it as I go, in my own words, so that if I stop for two weeks and come back, I can pick up exactly where I left off — and so someone else could follow it from zero.

I am building a digital platform for Compassionate Care Plus, a home health organization in Texas. It has two halves: a public website anyone can visit, and a private application where patients, families, caregivers, nurses and administrators sign in.

---

# PART 0 — The words I kept seeing

Before the first command, here is what the vocabulary actually means. Nothing here is complicated once it is said plainly.

**Node.js** — a program that runs JavaScript on my computer instead of inside a browser. Every modern web tool needs it.

**npm** — the thing that downloads code other people wrote. It comes with Node.js. When I run `npm install`, it reads a list of needed packages and fetches them.

**React** — a way of building interfaces out of small reusable pieces called components. A component is a function that returns something that looks like HTML.

**Next.js** — a framework built on top of React. It handles routing (which URL shows which page), rendering on the server, image optimization and the build process. I am using it because it lets me render pages on the server, which matters when the page might contain patient information: if it renders on the server, the data never has to travel to the browser at all.

**TypeScript** — JavaScript with types. I say "this function takes a patient id, which is text" and the editor tells me immediately if I pass the wrong thing. It feels like extra work for about a week and then it starts saving me.

**Tailwind CSS** — styling by writing small classes in the markup (`p-4`, `text-lg`) instead of writing separate CSS files.

**Terminal** — the black window where I type commands. In VS Code: menu **Terminal → New Terminal**.

**Repository (repo)** — a folder that Git is tracking.

**Git** — records snapshots of my project so I can go back if I break something.

**GitHub** — where those snapshots live online.

---

# PART 1 — PHASE 1: getting the project to exist

## Step 1 — Check that Node.js is installed

1. Open **VS Code**.
2. Click **Terminal** in the top menu.
3. Click **New Terminal**.
4. Type this and press Enter:

```bash
node -v
```

**What I should see:** a version number like `v22.22.2`.

I need **v20.9.0 or higher**. If the number is lower, or if I get "node is not recognized", I go to <https://nodejs.org>, download the **LTS** version for Windows, run the installer, click Next through it, then **close VS Code completely and reopen it** before trying again. That last part matters — the terminal only picks up new programs when it restarts.

Then I check npm as well:

```bash
npm -v
```

**What I should see:** something like `10.9.7`.

## Step 2 — Decide where the project lives

I keep projects out of OneDrive folders, because OneDrive syncing a `node_modules` folder with tens of thousands of files causes strange errors.

In the terminal:

```bash
cd C:\
mkdir dev
cd dev
```

**What this does:** `cd` means "change directory" — move into a folder. `mkdir` means "make directory". So now I am sitting in `C:\dev`.

If `C:\dev` already exists, `mkdir dev` will complain and that is fine — I just run `cd dev` and carry on.

## Step 3 — Create the project

This one command downloads and sets up a whole Next.js project:

```bash
npx create-next-app@latest compassionate-care-plus --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --no-git
```

**What each part means:**

| Part | What it does |
|---|---|
| `npx` | Runs a tool once without permanently installing it |
| `create-next-app@latest` | The official Next.js project generator, newest version |
| `compassionate-care-plus` | The folder it creates |
| `--typescript` | Use TypeScript, not plain JavaScript |
| `--tailwind` | Set up Tailwind CSS for me |
| `--eslint` | Set up the code checker |
| `--app` | Use the App Router (the modern routing system) |
| `--src-dir` | Put my code in a `src` folder so the project root stays tidy |
| `--import-alias "@/*"` | Lets me write `@/components/Button` instead of `../../../components/Button` |
| `--use-npm` | Use npm rather than another package manager |
| `--turbopack` | Use the faster build engine |
| `--no-git` | Do not start Git yet — I want to do that myself in Step 8 so I understand it |

It may ask me a question or two anyway. If it does, I accept the defaults matching the flags above.

**What I should see:** it prints a list of packages, takes 30–90 seconds, and finishes with:

```
Success! Created compassionate-care-plus at C:\dev\compassionate-care-plus
```

**If it fails:** the usual causes are no internet, a company/school network blocking npm, or antivirus interfering. See `docs/TROUBLESHOOTING.md`.

## Step 4 — Open the project properly

The project is created but VS Code is not "in" it yet.

1. Click **File**.
2. Click **Open Folder**.
3. Navigate to `C:\dev\compassionate-care-plus`.
4. Select that folder and click **Select Folder**.
5. If VS Code asks whether I trust the authors, click **Yes, I trust the authors** — I wrote it.

Now the file list on the left shows my project.

## Step 5 — Understand every folder I was given

This is worth five minutes, because otherwise the project is a mystery box.

```
compassionate-care-plus/
├── node_modules/       All the downloaded code. Thousands of files. I never edit
│                       this and I never commit it. It can always be rebuilt with
│                       "npm install".
├── public/             Files served to anyone who knows the URL. Logos, icons.
│                       IMPORTANT: patient documents must NEVER go here, because
│                       anything in public/ has no permission check at all.
├── src/
│   └── app/            The App Router. Every folder here becomes a URL.
│       ├── layout.tsx  The wrapper around every page: <html>, <body>, fonts.
│       ├── page.tsx    The page at "/". A file named page.tsx = a visitable URL.
│       ├── globals.css Styles that apply everywhere.
│       └── favicon.ico The little browser tab icon.
├── docs/               My documentation. I created this folder.
├── .gitignore          A list of things Git must never record - secrets, node_modules.
├── .env.example        A template showing which settings exist, with no real values.
├── eslint.config.mjs   Code-checking rules.
├── next.config.ts      Next.js settings. Almost empty for now.
├── package.json        The project's ID card: name, scripts, dependency list.
├── package-lock.json   The exact versions installed. This DOES get committed, so
│                       that the project builds identically on another machine.
├── postcss.config.mjs  Wiring that lets Tailwind process my CSS.
├── tsconfig.json       TypeScript settings, including the "@/" shortcut.
└── README.md           The front door of the project.
```

**The single most important idea in Next.js:** folders inside `src/app` become URLs. `src/app/about/page.tsx` becomes `/about`. I do not configure routes anywhere; I create folders.

## Step 6 — Run it

In the terminal (make sure I am inside the project folder — the terminal prompt should end in `compassionate-care-plus`):

```bash
npm run dev
```

**What this does:** starts the development server. It watches my files and reloads the browser whenever I save.

**What I should see:**

```
▲ Next.js 16.3.5
- Local:  http://localhost:3000
✓ Ready in 1.2s
```

Now I open <http://localhost:3000> in my browser.

**What I should see in the browser:** a plain page saying "Phase 1 — project initialization / Compassionate Care Plus", with a note that the real homepage comes in Phase 4.

**To stop the server:** click in the terminal and press `Ctrl + C`.

**If port 3000 is already in use:** something else is running there. Either close it, or run `npm run dev -- -p 3001` and use <http://localhost:3001>.

## Step 7 — The files I changed, and why

The generator gives everyone the same demo page. I replaced it with something honest about what this project currently is.

- `src/app/page.tsx` — a placeholder homepage that says plainly that nothing has been confirmed with the organization yet.
- `src/app/layout.tsx` — set the page title, and added `robots: { index: false }` so search engines do not index a development build.
- `src/app/globals.css` — removed the generator's default dark-mode colors and its downloaded typeface (I am not choosing fonts before Phase 2, and the system font needs no download) (I do not want an accidental design before Phase 2), and added a `prefers-reduced-motion` rule. That rule means: if someone has told their operating system that animation makes them unwell, this site stops animating. I am adding it in Phase 1 rather than remembering it in Phase 34.
- `.env.example` — the template for settings. Committed on purpose, with no real values in it.
- `.gitignore` — added `!.env.example` so that my template file is the one exception to "never commit env files".
- Deleted `AGENTS.md` and `CLAUDE.md` — generator extras I do not need.

## Step 8 — Start Git and make the first commit

Git is how I stop being afraid of breaking things.

First check it is installed:

```bash
git --version
```

If that errors, I install Git from <https://git-scm.com/download/win>, accept the defaults, then restart VS Code.

Tell Git who I am (only needed once per computer):

```bash
git config --global user.name "My Name"
git config --global user.email "myemail@example.com"
```

Now, inside the project folder:

```bash
git init
```

**What it does:** creates a hidden `.git` folder. This project is now a repository.

```bash
git status
```

**What it does:** shows what has changed. Right now everything is "untracked" — Git sees the files but is not recording them yet. I should **not** see `node_modules` or `.env` in this list. If I do, something is wrong with `.gitignore` and I stop and fix it before continuing.

```bash
git add .
```

**What it does:** stages everything — "these are the changes I want in my next snapshot". The `.` means "this folder and everything in it", minus whatever `.gitignore` excludes.

```bash
git commit -m "Phase 1: initialize Next.js project with TypeScript, Tailwind and documentation"
```

**What it does:** takes the snapshot. The `-m` is the message explaining what this snapshot is. Good messages describe *why*, not "update files".

```bash
git log --oneline
```

**What I should see:** one line with a short code and my message. That code is the commit id — I can always come back to this exact state.

## Step 9 — Push to GitHub

1. Go to <https://github.com> and sign in.
2. Click the **+** in the top right, then **New repository**.
3. Name: `compassionate-care-plus`.
4. **Do not** tick "Add a README" — I already have one, and it would create a conflict.
5. Click **Create repository**.
6. GitHub shows me commands. I use the "push an existing repository" ones:

```bash
git remote add origin https://github.com/MY-USERNAME/compassionate-care-plus.git
git branch -M main
git push -u origin main
```

**What these do:** the first tells Git where online this project lives. The second names my main line of work `main`. The third uploads it, and `-u` remembers the destination so future pushes are just `git push`.

**A rule I am keeping:** this repository is public for now, which is only acceptable because it contains placeholder content and synthetic data. Before the first real setting or any real organizational data exists, I make it private. Anything committed to a public repo should be treated as permanently public — deleting it later does not really remove it.

---

# WHAT I ACTUALLY LEARNED IN PHASE 1

- A folder inside `src/app` becomes a URL. That is the whole routing system.
- `layout.tsx` wraps every page; `page.tsx` is a page.
- `node_modules` is disposable; `package-lock.json` is not.
- `.gitignore` is a security control, not housekeeping.
- Git in four moves: `status` → `add` → `commit` → `push`.

**Next up: Phase 2 — the design system.** Colors, typography, spacing, and the first real components. That is where the project stops looking like a default template.
