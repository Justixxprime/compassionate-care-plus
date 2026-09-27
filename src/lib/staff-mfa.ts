// Emergency staff MFA recovery. This intentionally has a narrower scope than
// ordinary staff administration: a different administrator must re-enter
// their own password, the target must be a staff account in the same
// organization, and all target sessions are revoked.

import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor } from "@/lib/auth/actor";

const NON_STAFF_ROLES = ["PATIENT", "AUTHORIZED_FAMILY", "REFERRAL_PARTNER"];

export type StaffMfaResetResult = { ok: true } | { ok: false; error: string };

export async function resetStaffMfa(
  actorUserId: string,
  targetUserId: string,
  currentPassword: string,
): Promise<StaffMfaResetResult> {
  await requirePermission(actorUserId, "staff.manage");
  const actor = await loadActor(actorUserId);
  if (!targetUserId || targetUserId === actor.id) {
    return { ok: false, error: "Use your own Sign-in security page to change your authenticator app." };
  }

  const actorWithPassword = await prisma.user.findUnique({
    where: { id: actor.id }, select: { passwordHash: true },
  });
  if (!actorWithPassword || !(await bcrypt.compare(currentPassword, actorWithPassword.passwordHash))) {
    await auditDenied(actor, "staff_mfa_reset", targetUserId || undefined);
    return { ok: false, error: "Your current password did not match." };
  }

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, organizationId: actor.organizationId },
    select: { id: true, userRoles: { select: { role: { select: { key: true } } } } },
  });
  const isStaff = target?.userRoles.some((assignment) => !NON_STAFF_ROLES.includes(assignment.role.key));
  if (!target || !isStaff) {
    await auditDenied(actor, "staff_mfa_reset", targetUserId);
    return { ok: false, error: "That staff account could not be found." };
  }

  await prisma.$transaction([
    prisma.mfaFactor.deleteMany({ where: { userId: target.id } }),
    prisma.mfaChallenge.deleteMany({ where: { userId: target.id } }),
    prisma.session.deleteMany({ where: { userId: target.id } }),
  ]);
  await auditAllowed(actor, "staff_mfa_reset", "user", target.id);
  return { ok: true };
}
