# ADR-001: Secure account and document services

**Status:** Accepted
**Date:** 26 September 2026
**Decider:** Cheliv Compassionate Care Plus Inc.

## Context

The demo stores document bytes in PostgreSQL and has no e-mail delivery,
password recovery, staff MFA, external encrypted storage, or malware scan.
That is acceptable only for synthetic local data. Real protected records need
private storage, encryption with access controls, a malware quarantine path,
and a reliable delivery channel for account-recovery notices.

## Decision

- Use **Amazon S3 with SSE-KMS**, a private bucket, least-privilege IAM roles,
  public-access block, versioning, and CloudTrail for production documents.
- Use **Amazon GuardDuty Malware Protection for S3** to scan uploads before a
  document is marked available. Clean and unsafe files must be routed to
  separate private locations; the application never serves an unscanned file.
- Use **Resend** for transactional account-recovery mail during development
  and early production. Configure a verified organization-owned sending domain
  before sending real recovery messages.
- Use **TOTP authenticator-app MFA** for staff. Recovery codes are one-time,
  hashed, and shown only when generated. MFA secrets are encrypted with a
  dedicated application key before database storage.

## Options considered

### Keep files in PostgreSQL and use no scan

Low setup cost, but it has no isolated quarantine or production-grade object
storage workflow. Rejected for real patient documents.

### Use a free object-storage or e-mail tier as the production security model

Useful for development, but free tiers do not replace contract, key-management,
availability, audit, and compliance review requirements. Rejected for real
protected data.

### AWS protected-document pipeline

Higher setup cost, but provides private object storage, KMS-controlled
encryption, audit tooling, and a managed malware scanning path. Accepted.

## Consequences and next actions

1. Create the AWS account and complete the required business/compliance review
   before uploading any real patient document.
2. Create a private S3 bucket, KMS key, and GuardDuty Malware Protection plan;
   never place credentials in the repository.
3. Add the AWS SDK only after the bucket, region, KMS key, and IAM role values
   are available. Replace only the storage boundary in `src/lib/documents.ts`.
4. Create and verify the Resend sending domain, then add reset-token delivery.
5. Add TOTP enrollment, challenge, recovery codes, and a mandatory MFA policy
   for staff after an application encryption key is stored in deployment secrets.

## References

AWS documents that S3 supports KMS-backed server-side encryption and recommends
policy enforcement for SSE-KMS: [AWS KMS best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/aws-kms-best-practices/aws-kms-best-practices.pdf).
AWS describes a private S3 malware-protection architecture using GuardDuty,
EventBridge, and KMS: [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/secure-file-transfers.html).
