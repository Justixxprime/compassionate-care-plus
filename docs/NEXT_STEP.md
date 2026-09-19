# NEXT_STEP.md

**Last updated:** 19 September 2026
**Just finished:** Documents, the fourth slice of Milestone D

---

## What I just completed

Documents: a file (PDF, PNG or JPEG, up to 2 MB) filed against a patient. Examples are a signed consent, a physician order, an insurance card, a scan of an ID.

Files are very sensitive, so this slice asks a new question. Not only "which patient" but "what kind of document". Insurance and identification documents are RESTRICTED. Only administrative roles can see, download or file them. A nurse on the care team sees the consent and the physician order, but never the scan of the patient's ID or insurance card. To a nurse, a restricted document does not even exist: it is missing from the list, and asking for it directly gets the same "not found" as an id that was never real.

Three more things worth knowing:
- A file's type is read from the file itself, not from its name. A script renamed `.pdf` is refused.
- Downloading is its own door (a plain link, not a form). It re-checks everything and every download is written to the audit log. This is the first time READING is logged.
- Archive hides a document everywhere but never deletes it.

Like the last rounds, this was really TESTED before it reached you: type check clean, lint clean, production build clean, and `npm run verify:access` passed 254 checks. I broke eight rules on purpose in a copy and the test failed on those rules each time. I also downloaded files from the real built app as each demo account. The rendered pages and the download link behaved exactly as designed.

What I could NOT test is the upload form itself in a browser, because there is no browser here. The rules under the form are fully tested. Only the thin part that reads the chosen file is untested. Please try it once by hand (step 3 below).

Your last round: everything you ran passed. The red "1 Issue" badge is gone, so it was a browser extension after all.

## IMPORTANT - one new migration, and no file to delete

One new pair of tables this round: `documents` and `document_files`. Run the migration command below. No new dependencies, so `npm install` will just say up to date.

## What files were created

- `src/lib/documents.ts` - every document rule, in one place
- `src/lib/document-constants.ts` - the kinds of document, which are restricted, size limits, file checks
- `src/lib/documents-actions.ts` - thin server actions for upload and archive
- `src/app/documents/page.tsx`, `upload-document-form.tsx`, `archive-button.tsx`
- `src/app/documents/[id]/download/route.ts` - the only door a file leaves through
- `prisma/demo-pdf.ts` - builds tiny real PDFs for the demo data and the tests
- `docs/DOCUMENTS.md`

## What files changed

- `prisma/schema.prisma` - added `Document` and `DocumentFile`
- `prisma/seed.ts` - five synthetic documents
- `scripts/verify-access.ts` - new sections for documents (254 checks now)
- `next.config.ts` - the upload size cap for form submissions raised from 1 MB to 3 MB, so a 2 MB document can travel
- `src/app/dashboard/page.tsx` - "View documents" link
- Docs: `CHANGELOG`, `PHASE_STATUS`, `PROJECT_HANDOFF`, `CONTINUATION_PROMPT`, `RBAC`, `AUDIT_LOGGING`, `DATABASE`, `FOLDER_STRUCTURE`, `TROUBLESHOOTING`, `DEMO_ACCOUNTS`

`src/app/layout.tsx` and the homepage were not touched this round. I still name-checked both (see the end of my reply).

## How to test it on your machine

```powershell
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
npm install
npx prisma migrate dev --name add_documents
npx prisma db seed
npm run verify:access
```

**Expect** the seed to say "5 synthetic demo documents ready". **Expect** `verify:access` to end with `254 passed, 0 failed` and `Every access rule held.` If anything FAILs, send me the FAIL lines.

Then the browser test:

```powershell
npm run dev
```

1. Sign in as `demo.admin@cheliv.test`, open `/documents`. You should see FIVE documents, two marked **Restricted** (Eleanor's insurance card and Marcus's photo ID). Press Download on one: a small PDF should download and open. Right-click the Download button on the insurance card, copy the link address, and keep it. Archive is available on every row. Do NOT archive anything yet.
2. Sign out. Sign in as `demo.nurse@cheliv.test`. You should see only TWO documents: Eleanor's consent and physician order. No insurance card, no Archive buttons. Paste the insurance card link you copied into the address bar. You should get the plain words "That document could not be found." Now try a made-up link such as `/documents/abc/download`. The words should be exactly the same.
3. Still as the nurse, try the upload form. The patient list should show only Eleanor and the kinds should be only Consent form, Physician order and Care correspondence. Upload a small PDF or a small screenshot (PNG or JPG): it should say "Document filed." and appear in the list. Then try to break it: a `.txt` file, a text file you renamed to `.pdf`, a file over 2 MB, and the same PDF a second time. Each should be refused with a plain message. If the upload form does anything strange (no message, an error page, nothing happens), tell me exactly what you saw.
4. Sign out. Sign in as `demo.nurse2@cheliv.test`. You should see only Marcus's consent, never his photo ID.
5. Sign in as the admin again and look at the audit list on the dashboard. You should see `document_downloaded` entries for the downloads you did, and `document_uploaded` for the nurse's upload.

Steps 3 and 1 change the demo data. To get the starting point back later, delete the extra documents in Prisma Studio, or archive them as the admin.

```powershell
npm run build
npm run lint
npx tsc --noEmit
```

## Decisions that are yours

- **Where the files really live.** Right now file contents sit inside the database. That is fine for made-up demo data, but WRONG for real patient files. Before any real document is ever uploaded, we need encrypted object storage with short-lived download links, plus virus scanning. Most options cost money, so this is your call. Tell me when you want to price it. I will not choose or sign up for anything without asking.
- Only SUPER_ADMIN can archive today. ADMIN can file and download but not archive. Say so if you want ADMIN to archive too.
- Which kinds of document are restricted: insurance and identification. Say so if consents should be restricted as well, or if a nurse should see the insurance card for billing calls.
- Nurses can see colleagues' visits on shared patients but cannot change them (still open).
- Any nurse on a patient's team can edit a draft care plan, not only its author (still open).
- Only ADMIN and SUPER_ADMIN can approve care plans. CLINICAL_SUPERVISOR and CARE_COORDINATOR still hold no permissions (still open).
- The repo is public and `docs/PROJECT_HANDOFF.md` names the owner and says this is a surprise. Your call whether to make the repo private or trim that file (still open).

## What comes next

Referrals, the last slice of Milestone D. After that, Milestone D is finished and I will do a full review pass before proposing Milestone E, the real staff-facing screens. I will ask you before starting that.

## Exact next commands after you have tested

```powershell
git add .
git commit -m "Documents with restricted categories, audited downloads and access verification"
git push
```
