# Password recovery

The sign-in page has a **Forgot password?** link. It always says the same
thing after a request, whether the e-mail exists, delivery is disabled, or the
request was rate-limited. That protects account privacy.

When delivery is configured, a recovery link is valid for 20 minutes and can
be used once. The database stores only a SHA-256 fingerprint of the random
token, never the usable secret. A completed reset changes the password and
revokes every active session for that account.

## Turn on delivery when you are ready

1. Create a Resend account or add Resend through the Vercel Marketplace.
2. In Resend, add an organization-owned domain and copy its DNS records into
   the company domain provider. Wait until Resend says the domain is verified.
3. In Vercel, open the Cheliv project, then **Settings → Environment
   Variables**. Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Use a sender on
   the verified domain, such as `Cheliv Care <support@yourdomain.com>`.
4. Add the same values to the private local `.env.local` file if you want to
   test locally. Never paste either value into chat or commit it.
5. Redeploy, then request a password reset for a test account. The recovery
   e-mail itself contains no patient, visit, or message information.

Until those values exist, the recovery page stays safe and generic but sends
nothing. This is intentional: generating a reset link that cannot be
delivered would be unsafe.
