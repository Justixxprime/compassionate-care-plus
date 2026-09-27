# DEPLOYMENT.md

**Last updated:** 27 September 2026

## In plain words

There are two copies of this project running, and they are not the same machine.

1. **Your laptop** (`localhost:3000`): the website runs locally and can use your local environment settings.
2. **The live site on Vercel** (`compassionate-care-plus.vercel.app`): the website uses Vercel environment variables and the hosted Neon database configured for the project.

Never assume the two environments contain the same data or secrets. The public deployment remains a demonstration system until the production compliance gate is complete.

## What the live site shows now

The public site, password recovery, care-request flow, and portal sign-in can use the hosted configuration when the required Vercel variables are present. Secure portal pages still enforce authentication and server-side authorization.

If `DATABASE_URL` is missing, the database is unreachable, or its tables do not exist, portal availability protections prevent ordinary sign-in from exposing records. Any production outage must be handled under `docs/INCIDENT_RESPONSE_PLAN.md`.

`/design-system` (the internal style page) is "not found" on the live site.

## Showing the internal app to someone

For the uncle demonstration, use synthetic data only. You can use the deployed site or screen-share your local app with `npm run dev`. Never demonstrate real patient information.

## Hosted portal safety checks

1. Keep `DATABASE_URL`, `AUTH_SECRET`, R2 credentials, Resend key, scanner token, and Turnstile secret as Vercel **Secrets**, never Config values.
2. Use the Neon pooled connection for Vercel. Apply production migrations with `npx prisma migrate deploy`, never `migrate dev` or a database reset.
3. Do not run demo seeding against the hosted production database.
4. Redeploy after any environment-variable change.
5. Before actual patient operations, complete `docs/PRODUCTION_COMPLIANCE_GATE.md`, including contracts, restore drill, scanning workflow, retention approval, and incident exercise.

## Care requests and email

`/request-care` records a request and sends a privacy-safe office notification when the database and Resend settings are configured. The notification intentionally contains no patient name, care details, or message content. Set `CARE_REQUEST_NOTIFY_EMAIL` to the approved office mailbox. Configure the real verified Resend sender before real use, as described in `docs/RESEND_DOMAIN_SETUP.md`.
