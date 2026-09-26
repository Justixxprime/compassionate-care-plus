"use server";

import { redirect } from "next/navigation";
import { roleKeysOf } from "@/lib/app/access";
import { writeAuditLog } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/session";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  verifyMfa,
  type EnrollmentConfirm,
  type EnrollmentStart,
} from "@/lib/auth/mfa";
import {
  consumeMfaChallengeUser,
  createSession,
  destroyMfaChallenge,
} from "@/lib/auth/session";

export type MfaStartState = EnrollmentStart | { ok: false; error: string };
export type MfaConfirmState = EnrollmentConfirm | { ok: false; error: string };
export interface MfaChallengeState { error?: string }

export async function beginMfaEnrollmentAction(
  _previous: MfaStartState,
  formData: FormData,
): Promise<MfaStartState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };

  const result = await beginMfaEnrollment(
    user.id,
    String(formData.get("password") ?? ""),
    roleKeysOf(user),
  );
  if (result.ok) {
    await writeAuditLog({ organizationId: user.organizationId, actorUserId: user.id, actorEmail: user.email, action: "mfa_enrollment_started", outcome: "allowed" });
  }
  return result;
}

export async function confirmMfaEnrollmentAction(
  _previous: MfaConfirmState,
  formData: FormData,
): Promise<MfaConfirmState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Please sign in again." };

  const result = await confirmMfaEnrollment(user.id, String(formData.get("code") ?? ""));
  if (result.ok) {
    await writeAuditLog({ organizationId: user.organizationId, actorUserId: user.id, actorEmail: user.email, action: "mfa_enabled", outcome: "allowed" });
  }
  return result;
}

export async function completeMfaChallengeAction(
  _previous: MfaChallengeState,
  formData: FormData,
): Promise<MfaChallengeState> {
  const user = await consumeMfaChallengeUser();
  if (!user) return { error: "This sign-in check expired. Please sign in again." };

  const result = await verifyMfa(user.id, String(formData.get("code") ?? ""));
  if (!result.ok) {
    await writeAuditLog({ organizationId: user.organizationId, actorUserId: user.id, actorEmail: user.email, action: "mfa_challenge_failed", outcome: "denied" });
    return { error: "That code did not match. Try the newest authenticator code or an unused recovery code." };
  }

  await destroyMfaChallenge();
  await createSession(user.id);
  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: result.usedRecoveryCode ? "mfa_recovery_code_used" : "mfa_challenge_completed",
    outcome: "allowed",
  });
  redirect("/dashboard");
}
