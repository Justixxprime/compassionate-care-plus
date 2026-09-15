# NEXT_STEP.md

**Last updated:** 15 September 2026
**Just finished:** Phase 7 — the real request-care form

---

## Important finding this phase

Your uncle's Facebook confirms the real legal name is **"Cheliv Compassionate Care Plus INC"** - he's listed as CEO/Founder/Administrator of it. This means the Cheliv mock wasn't referencing someone else's business - it was a mock of this exact organization, just under its full name. That closes the loop on everything confirmed so far.

**Open question, still waiting on an answer:** should every mention of "Compassionate Care Plus" across the site become "Cheliv Compassionate Care Plus" to match the real name? This touches the header, footer, page titles, and About copy - a clean find-and-replace once confirmed, but I didn't want to do it twice.

## What I just completed

Built the real request-care form: full name, email, phone, relationship to the patient, preferred contact method, service interest (pulled from the real services list), best time to contact, and an optional message - with a note asking people not to put sensitive medical details in that field. Real client-side validation, and a real success state once submitted.

## What files were created

- `src/components/marketing/request-care-form.tsx` - the form itself
- `src/app/(public)/request-care/page.tsx` - rewritten from a stub into the real page, with the real office phone as a fallback for anything urgent

## Important honesty note - there is no backend yet

The form validates for real and shows a genuine success message, but **nothing is actually sent or saved anywhere right now**. There's no database or API yet - that's Milestone C. Right now submitting the form just waits half a second and shows the success state; it doesn't email anyone or store anything. Once the backend spine exists, wiring this to a real destination (email notification, or a `referrals` row in the database) is a small change to one function inside the form component - the form itself doesn't need to be rebuilt.

## How to test it

```bash
npm install
npm run dev
```

Visit `/request-care`. Try submitting with fields empty - the browser's built-in validation should stop you (required fields, valid email format). Fill it out properly and submit - you should see the success message with the real phone number.

```bash
npm run build
npm run lint
npx tsc --noEmit
```

All three pass clean - checked before packaging this.

## What should work

- Every required field is enforced (name, relationship, email, phone)
- Email field rejects an invalid format
- The service dropdown lists the real six services
- Submitting shows a success message with a working `tel:` link to the real office number

## Known issues

- Submissions go nowhere yet - see the honesty note above
- The "Cheliv" naming question is still open

## What comes next

Depends on your answer to the naming question:
- If yes: a quick global rename pass before anything else
- Either way: Phase 8 is next per the plan - authentication architecture, which starts Milestone C (database, auth, API) and is what the request-care form (and everything else) actually needs to become real

## Exact next command

```bash
cd C:\Users\LENOVO\OneDrive\Desktop\compassionate-care-plus
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run dev
```

Test `/request-care`, then:

```bash
git add .
git commit -m "Phase 7: real request-care form"
git push
```
