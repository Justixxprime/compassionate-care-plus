// Self-service account settings. These operations always identify the user
// from the server-side session, never from a form-supplied user id.

import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { isPlausibleEmail, normalizeEmail, passwordProblem } from "@/lib/account-constants";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";

const BCRYPT_COST = 12;
const SESSION_COOKIE = "ccp_session";

export type AccountSettingsResult = { ok: true; message: string } | { ok: false; error: string };
export interface SuperAdminRecipient { id: string; name: string; email: string }

function validName(rawName: string): string | null {
  const name = rawName.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 120 ? name : null;
}

async function confirmCurrentPassword(userId: string, currentPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, organizationId: true, passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return null;
  return user;
}

export async function updateOwnProfile(
  userId: string,
  input: { name: string; email: string; currentPassword: string },
): Promise<AccountSettingsResult> {
  const name = validName(input.name);
  const email = normalizeEmail(input.email);
  if (!name) return { ok: false, error: "Enter a name between 2 and 120 characters." };
  if (!isPlausibleEmail(email)) return { ok: false, error: "Enter a valid email address." };

  const currentUser = await confirmCurrentPassword(userId, input.currentPassword);
  if (!currentUser) return { ok: false, error: "Your current password did not match." };

  const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== userId) return { ok: false, error: "That email address is already in use." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      // An email change must be verified again once verified-email flows are
      // enabled. It is safer to clear a previous verification than carry it.
      ...(email !== currentUser.email ? { emailVerifiedAt: null } : {}),
    },
  });
  await writeAuditLog({
    organizationId: currentUser.organizationId,
    actorUserId: userId,
    actorEmail: email,
    action: email !== currentUser.email ? "own_email_updated" : "own_profile_updated",
    outcome: "allowed",
  });
  return { ok: true, message: "Your account details were updated." };
}

export async function changeOwnPassword(
  userId: string,
  input: { currentPassword: string; password: string; confirmPassword: string },
): Promise<AccountSettingsResult> {
  if (input.password !== input.confirmPassword) return { ok: false, error: "The two new passwords do not match." };
  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, error: problem };

  const currentUser = await confirmCurrentPassword(userId, input.currentPassword);
  if (!currentUser) return { ok: false, error: "Your current password did not match." };
  if (await bcrypt.compare(input.password, currentUser.passwordHash)) {
    return { ok: false, error: "Choose a new password that is different from your current password." };
  }

  // Preserve only the cookie-backed session that made this request. Every
  // other device is removed, so a password change also contains compromise.
  const currentSessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!currentSessionId) return { ok: false, error: "Your current session could not be confirmed. Sign in again." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(input.password, BCRYPT_COST) } });
    await tx.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
    await tx.mfaChallenge.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
  });
  await writeAuditLog({
    organizationId: currentUser.organizationId,
    actorUserId: userId,
    actorEmail: currentUser.email,
    action: "own_password_changed",
    outcome: "allowed",
  });
  return { ok: true, message: "Password changed. Other signed-in devices were signed out." };
}

export async function getSuperAdminRecipients(userId: string): Promise<SuperAdminRecipient[]> {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, userRoles: { include: { role: { select: { key: true } } } } },
  });
  if (!actor?.userRoles.some(({ role }) => role.key === "SUPER_ADMIN")) return [];
  const users = await prisma.user.findMany({
    where: {
      organizationId: actor.organizationId,
      id: { not: userId },
      userRoles: { some: { role: { key: "ADMIN" } } },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export async function transferSuperAdmin(
  actorUserId: string,
  input: { targetUserId: string; currentPassword: string },
): Promise<AccountSettingsResult> {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: {
      email: true, organizationId: true, passwordHash: true,
      userRoles: { include: { role: { select: { id: true, key: true } } } },
    },
  });
  const superAdminRole = actor?.userRoles.find(({ role }) => role.key === "SUPER_ADMIN")?.role;
  if (!actor || !superAdminRole) return { ok: false, error: "Only the current Super Admin can transfer this role." };
  if (!(await bcrypt.compare(input.currentPassword, actor.passwordHash))) return { ok: false, error: "Your current password did not match." };

  const roles = await prisma.role.findMany({
    where: { organizationId: actor.organizationId, key: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, key: true },
  });
  const adminRole = roles.find((role) => role.key === "ADMIN");
  const orgSuperRole = roles.find((role) => role.key === "SUPER_ADMIN");
  const target = await prisma.user.findFirst({
    where: {
      id: input.targetUserId,
      organizationId: actor.organizationId,
      userRoles: { some: { role: { key: "ADMIN" } } },
    },
    select: { id: true },
  });
  if (!target || !adminRole || !orgSuperRole) return { ok: false, error: "Choose an existing administrator in this organization." };

  await prisma.$transaction(async (tx) => {
    await tx.userRole.upsert({ where: { userId_roleId: { userId: target.id, roleId: orgSuperRole.id } }, create: { userId: target.id, roleId: orgSuperRole.id }, update: {} });
    await tx.userRole.upsert({ where: { userId_roleId: { userId: actorUserId, roleId: adminRole.id } }, create: { userId: actorUserId, roleId: adminRole.id }, update: {} });
    await tx.userRole.delete({ where: { userId_roleId: { userId: actorUserId, roleId: superAdminRole.id } } });
  });
  await writeAuditLog({ organizationId: actor.organizationId, actorUserId, actorEmail: actor.email, action: "super_admin_transferred", resourceType: "user", resourceId: target.id, outcome: "allowed" });
  return { ok: true, message: "Super Admin access was transferred. You remain an Administrator." };
}
