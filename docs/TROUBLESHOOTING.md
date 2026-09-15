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

Something else is using it — often a dev server I forgot to stop.

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

Either the file does not exist at that path, or the capitalization is different. Windows does not care about capital letters in filenames but the build server does — `Button.tsx` and `button.tsx` are different files as far as deployment is concerned. I keep filenames consistent.

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
