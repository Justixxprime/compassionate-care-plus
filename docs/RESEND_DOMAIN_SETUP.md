# Verified Resend domain for password recovery

Use this only when you own a real domain. A Vercel `*.vercel.app` address is a
website address, not a sending domain you can verify in Resend.

1. Buy or use a Cheliv-owned domain, such as `chelivcare.example`.
2. In Resend, open **Domains** and choose **Add domain**.
3. Enter only the domain name, then copy every DNS record Resend displays.
4. In the company that manages that domain's DNS (often Cloudflare), add each
   record exactly as shown. Do not delete existing website records.
5. Return to Resend and wait for the domain to show **Verified**.
6. In Vercel → project → **Settings** → **Environment Variables**, set
   `RESEND_FROM_EMAIL` to `Cheliv <security@your-domain.example>` and ensure
   `RESEND_API_KEY` is present only as a secret. Select **Production**.
7. Redeploy, request a password-recovery email for a test account, and verify
   that it arrives from the verified sender without any patient details.

Do not paste the API key or DNS-provider login anywhere in the application,
GitHub, or chat. Rotate a key immediately if it is ever exposed.
