-- Authenticator-app MFA for staff accounts. Secrets are encrypted by the
-- application; recovery codes are stored only as hashes.
CREATE TABLE "mfa_factors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recovery_code_hashes" TEXT[] NOT NULL,
    "verified_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_factors_user_id_key" ON "mfa_factors"("user_id");

CREATE TABLE "mfa_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_challenges_user_id_expires_at_idx" ON "mfa_challenges"("user_id", "expires_at");

ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "mfa_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
