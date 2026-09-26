// The empty hosted database needs exactly one safe way to receive its first
// administrator. This is not an ordinary public sign-up: it is enabled only
// while there are zero accounts AND the owner supplies a private Vercel secret.

import "server-only";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isPlausibleEmail, normalizeEmail, passwordProblem } from "@/lib/account-constants";
import { writeAuditLog } from "@/lib/audit/log";

const BCRYPT_COST = 12;
const ORGANIZATION_NAME = "Cheliv Compassionate Care Plus Inc";

const PERMISSIONS = [
  "patients.read", "patients.create", "patients.update", "patients.archive",
  "clinical_records.read", "clinical_records.create", "clinical_records.update",
  "care_plans.read", "care_plans.create", "care_plans.update", "care_plans.approve",
  "visits.read", "visits.create", "visits.update", "visits.document", "visits.review", "visits.checkin", "visits.caregiver_document",
  "portal.read", "portal.documents.read", "partner.referrals.create", "partner.referrals.read", "family.read", "consents.manage",
  "documents.read", "documents.upload", "documents.delete", "documents.grant", "messages.read", "messages.send",
  "referrals.read", "referrals.manage", "care_team.read", "care_team.manage", "tasks.read", "tasks.manage",
  "staff.manage", "roles.manage", "settings.manage", "reports.read", "audit.read", "security.read", "care_requests.manage",
] as const;

const ROLE_DEFINITIONS = [
  { key: "SUPER_ADMIN", name: "Super Admin", permissions: "ALL" as const },
  { key: "ADMIN", name: "Administrator", permissions: ["patients.read", "patients.create", "patients.update", "patients.archive", "clinical_records.read", "care_plans.read", "care_plans.approve", "visits.read", "visits.create", "visits.update", "visits.review", "documents.read", "documents.upload", "documents.grant", "messages.read", "messages.send", "referrals.read", "referrals.manage", "care_team.read", "care_team.manage", "tasks.read", "tasks.manage", "consents.manage", "staff.manage", "roles.manage", "settings.manage", "reports.read", "audit.read", "security.read", "care_requests.manage"] },
  { key: "CLINICAL_SUPERVISOR", name: "Clinical Supervisor", permissions: ["patients.read", "care_plans.read", "care_plans.approve", "visits.read", "visits.review", "documents.read", "care_team.read", "tasks.read", "tasks.manage"] },
  { key: "NURSE", name: "Nurse", permissions: ["patients.read", "clinical_records.read", "clinical_records.create", "clinical_records.update", "care_plans.read", "care_plans.create", "care_plans.update", "visits.read", "visits.create", "visits.update", "visits.document", "documents.read", "documents.upload", "messages.read", "messages.send", "referrals.read", "tasks.read", "tasks.manage"] },
  { key: "CAREGIVER", name: "Caregiver", permissions: ["visits.checkin", "visits.caregiver_document", "tasks.read"] },
  { key: "CARE_COORDINATOR", name: "Care Coordinator", permissions: ["patients.read", "patients.create", "referrals.read", "referrals.manage", "visits.read", "visits.create", "visits.update", "care_team.read", "care_team.manage", "tasks.read", "tasks.manage"] },
  { key: "PATIENT", name: "Patient", permissions: ["portal.read", "portal.documents.read", "messages.read", "messages.send"] },
  { key: "AUTHORIZED_FAMILY", name: "Authorized Family Member", permissions: ["family.read"] },
  { key: "REFERRAL_PARTNER", name: "Referral Partner", permissions: ["partner.referrals.create", "partner.referrals.read"] },
] as const;

function hasValidSetupToken(supplied: string): boolean {
  const expected = process.env.INITIAL_ADMIN_SETUP_TOKEN;
  if (!expected || expected.length < 32) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function firstAdminSetupAvailable(): Promise<boolean> {
  if (!(process.env.INITIAL_ADMIN_SETUP_TOKEN ?? "").trim()) return false;
  return (await prisma.user.count()) === 0;
}

export interface FirstAdminInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  setupToken: string;
}

export type FirstAdminResult = { ok: true; userId: string } | { ok: false; error: string };

export async function createFirstAdmin(input: FirstAdminInput): Promise<FirstAdminResult> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!hasValidSetupToken(input.setupToken)) return { ok: false, error: "Setup is not available." };
  if (!name || name.length > 120) return { ok: false, error: "Enter your full name." };
  if (!isPlausibleEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (input.password !== input.confirmPassword) return { ok: false, error: "The two passwords do not match." };
  const passwordIssue = passwordProblem(input.password);
  if (passwordIssue) return { ok: false, error: passwordIssue };
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (await tx.user.count()) throw new Error("SETUP_COMPLETE");
      const organization = await tx.organization.create({ data: { name: ORGANIZATION_NAME } });
      for (const key of PERMISSIONS) await tx.permission.upsert({ where: { key }, update: {}, create: { key } });
      const allPermissions = await tx.permission.findMany({ select: { id: true, key: true } });
      let superAdminRoleId = "";
      for (const definition of ROLE_DEFINITIONS) {
        const role = await tx.role.create({ data: { organizationId: organization.id, key: definition.key, name: definition.name } });
        if (definition.key === "SUPER_ADMIN") superAdminRoleId = role.id;
        const allowed = definition.permissions === "ALL"
          ? allPermissions
          : allPermissions.filter((permission) => (definition.permissions as readonly string[]).includes(permission.key));
        for (const permission of allowed) await tx.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      }
      const created = await tx.user.create({ data: { organizationId: organization.id, name, email, passwordHash } });
      await tx.userRole.create({ data: { userId: created.id, roleId: superAdminRoleId } });
      return { id: created.id, organizationId: organization.id, email: created.email };
    }, { isolationLevel: "Serializable" });

    await writeAuditLog({ organizationId: user.organizationId, actorUserId: user.id, actorEmail: user.email, action: "first_admin_created", outcome: "allowed" });
    return { ok: true, userId: user.id };
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_COMPLETE") return { ok: false, error: "Setup is not available." };
    throw error;
  }
}
