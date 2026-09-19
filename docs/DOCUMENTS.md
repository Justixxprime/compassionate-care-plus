# DOCUMENTS.md

**Added:** 19 September 2026
**Milestone D, slice 4.** Patients, then visits, then care plans, now documents.

---

## What a document is

One file filed against one patient: a signed consent, a physician order, an insurance card, a scan of an ID. Only PDF, PNG and JPEG files, up to 2 MB.

Files are the most sensitive thing the system holds after the clinical record itself. So this slice asks a question the earlier ones did not: not only WHICH PATIENT, but WHAT KIND of document.

## Three questions

1. **Permission.** `documents.read`, `documents.upload`, `documents.delete`. These three permissions already existed, so no new permission was needed. A hard stop (`requirePermission`).
2. **Relationship.** Can this person reach the patient? From `getPatientScope()` in `src/lib/patients.ts`, the same code every slice uses.
3. **Category.** Insurance and identification documents are RESTRICTED. Only administrative roles (the "organization" scope) can see, download or file them. A nurse on the care team sees the clinical paperwork (consent forms, physician orders, care correspondence) and never the scan of the patient's ID or insurance card. To a nurse, a restricted document does not exist: it is missing from lists, and asking for it directly gets the same "not found" as an id that was never real.

Why no "must be on the care team" question, unlike care plans: filing paperwork is an office job that administrative staff do for patients they are not caring for. The team question was about writing clinical JUDGMENT. Documents are controlled by their kind instead. For a nurse the two rules end up the same anyway, because a nurse's reach IS their assigned patients.

The category list lives in `src/lib/document-constants.ts`. A category the code does not recognise counts as restricted (it fails closed), so a mistyped or removed category hides a document rather than exposing it.

## Who can do what

| Action | Needs | Notes |
|---|---|---|
| See documents | `documents.read` + reach the patient | Restricted categories only for administrative roles. |
| Download | `documents.read` + reach + category | Every download is written to the audit log. |
| File a document | `documents.upload` + reach + category | Active patients only. Nurses can file the three clinical categories only. |
| Archive | `documents.delete` + reach + category | Held by SUPER_ADMIN only today. A nurse who files the wrong file cannot remove it. |

Who holds what today: SUPER_ADMIN holds everything. ADMIN holds read and upload but not delete. NURSE holds read and upload. Every other role holds none yet.

## The rules on the file itself

- The type is worked out from the file's own first bytes, never from the file name or from what the browser says. A text file renamed `.pdf` is refused. So is a script renamed `.pdf`.
- The stored file name is cleaned: no folders, no odd characters, and an extension that matches what the file really is. A PNG uploaded as `C:\fakepath\..\scan.pdf` is stored as `scan.png`.
- Never empty, never over 2 MB. The upload action refuses an oversized file before even reading it into memory.
- The same exact file cannot be filed twice for the same patient (a SHA-256 fingerprint of the bytes is stored on each document).
- Only active patients get new documents.

## Downloading is its own door

A download is a plain GET request to `/documents/[id]/download` (`src/app/documents/[id]/download/route.ts`). Unlike a Server Action, a plain route has no built-in guard, so all of its protection is the checks written into it and into `getDocumentForDownload`.

- Not signed in: 401.
- No permission: 403, and a permission_denied audit entry.
- Missing, out of reach, archived, or restricted: 404 with the SAME words every time.
- The file is always sent as a download (never displayed inside the site), typed by what its bytes really are, with content sniffing switched off (`X-Content-Type-Options: nosniff`) and caching forbidden (`Cache-Control: private, no-store`).

## Archiving

"Archive" hides a document from every list and download but keeps the row and the file bytes on record. Documents are never hard-deleted. Nobody can see or restore an archived document from the app yet; that is later work.

## Reading is audited

This is the first slice where reading is logged. Opening a file is exactly the event an investigation would ask about. New audit actions: `document_uploaded`, `document_downloaded`, `document_archived`, plus `access_denied` for refusals. As always the log records that it happened, never what the document said. Only the successful download is logged as a download; a refused attempt is logged as a denial.

## Where the file bytes live

The bytes are stored in the database, in their own table (`document_files`), separate from the document's details. That keeps the demo free and testable on one machine, and it means a list of documents can never pull file contents into memory by accident.

A real deployment should move them to encrypted object storage with short-lived download links. That is a paid-service decision and is deliberately NOT made here. Nothing outside `src/lib/documents.ts` knows where the bytes are, so the swap changes one file. Decide it before real patient documents are ever stored.

## Files

- `prisma/schema.prisma`: `Document` and `DocumentFile` models (new migration needed)
- `src/lib/documents.ts`: every document rule lives here
- `src/lib/document-constants.ts`: categories and which are restricted, size limits, file type detection, file name cleaning
- `src/lib/documents-actions.ts`: thin server actions for upload and archive
- `src/app/documents/`: the bare proof page, `upload-document-form.tsx`, `archive-button.tsx`, and the download route in `[id]/download/route.ts`
- `prisma/demo-pdf.ts`: builds small real PDFs for the seed and the test script (no new dependency)
- `next.config.ts`: Server Action request limit raised from 1 MB to 3 MB so a 2 MB document can travel
- `scripts/verify-access.ts`: sections 2c and 11a to 11f
- `prisma/seed.ts`: five synthetic documents

## Demo data and what to click

Eleanor Whitfield has a consent form, a physician order (filed by Demo Nurse) and an insurance card. Marcus Delgado has a consent form and a photo ID. Priya Raman has none. The insurance card and the photo ID are in restricted categories. Every demo document is a tiny real PDF that opens.

- As **admin**: all five, two marked Restricted, Download and Archive on each. The upload form offers all five categories and all three patients.
- As **nurse one**: only Eleanor's consent and physician order. The upload form offers only Eleanor and only the three clinical categories. No Archive button.
- As **nurse two**: only Marcus's consent.

## Proving it, not trusting it

`npm run verify:access` now runs 254 checks. The document part covers the permission gate, filing (including a nurse refused for restricted categories), file validation (a script renamed `.pdf` is refused), duplicates, who sees what, download checks that a restricted document looks exactly like one that does not exist, archiving that hides but does not delete, and the audit trail including downloads.

It was also tested the other way. Eight rules were broken on purpose in a copy of the code and the script failed on those rules each time: the list stops hiding restricted documents, the category rule off everywhere, the download path forgetting the category check, the file type no longer read from the bytes, downloads no longer audited, archived documents still downloadable, the relationship check removed from downloads, and the duplicate check removed.

The rendered pages and the real download route were also fetched over HTTP as each demo account. A restricted document, another patient's document and a made-up id all returned the same 404 with the same words. The downloaded bytes were a valid PDF.

## What was NOT tested end to end

The upload form's Server Action was not exercised over real HTTP in the build environment, because there is no browser there. The upload rules underneath it are fully tested. What is untested is only the thin wrapper that reads the chosen file from the form. Test it once by hand with a small PDF (see NEXT_STEP.md).

## Known gaps, written down honestly

- **Bytes are stored in the database.** Fine for synthetic demo data, wrong for real patient files. See above.
- **No virus scan.** Only the file's type is checked. A real deployment needs scanning before files are stored.
- **No encryption at rest beyond what the database itself provides.**
- **No archived-document viewer or restore.**
- **Listing is not audit-logged,** only downloads. Someone who can list can see titles and file names.
- **Only administrative roles can file restricted documents,** but CLINICAL_SUPERVISOR and CARE_COORDINATOR still hold no permissions, so today only ADMIN and SUPER_ADMIN can.
- **Titles and file names are not scanned for sensitive content.** Staff should not put a patient's ID number in a title. Say so in staff training.
- **The category list is fixed in code.** No "other" category on purpose: everything filed is deliberately labelled.
