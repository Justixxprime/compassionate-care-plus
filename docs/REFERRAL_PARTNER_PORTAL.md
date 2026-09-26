# Referral Partner portal

## What it does

`/partner-referrals` lets a hospital or physician-office partner send a
referral and follow only the high-level status of referrals they sent.

The `REFERRAL_PARTNER` role holds exactly two permissions:

- `partner.referrals.create`
- `partner.referrals.read`

## Privacy rules

- Ownership comes from the signed-in account and the referral's existing
  `created_by_id`, never an id supplied by the browser.
- A partner sees only their own submissions, in their own organization.
- The list returns only the referred person's name, source, sent date, and
  status. It never returns the clinical reason, date of birth, contact details,
  office notes, decision note, patient id, patient chart, or deciding staff.
- Partners can create a referral only as a hospital or physician-office source.
  They cannot edit, withdraw, review, accept, or decline it after sending.
- The existing duplicate-open-referral check still applies across the whole
  organization, so one person cannot be entered as competing open referrals.
- Creation is audited as `partner_referral_created`, without clinical text.

No schema migration is required. Run `npx prisma db seed` to add the two
permissions to an existing local database.
