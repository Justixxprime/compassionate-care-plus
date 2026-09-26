import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, loadActor } from "@/lib/auth/actor";
import { validateReferralDetails, type ReferralDetailsInput } from "@/lib/referrals";
import { REFERRAL_STATUS_LABELS, referralSourceLabel } from "@/lib/referral-constants";

export async function createPartnerReferral(userId: string, input: ReferralDetailsInput) {
  await requirePermission(userId, "partner.referrals.create");
  const actor = await loadActor(userId);
  const checked = validateReferralDetails({ ...input, officeNotes: "" });
  if (!checked.ok) return checked;
  const details = checked.value;
  if (details.sourceType !== "hospital" && details.sourceType !== "physician_office") return { ok: false as const, error: "Choose hospital or physician's office as the referral source." };
  const duplicate = await prisma.referral.findFirst({ where: { organizationId: actor.organizationId, status: { in: ["received", "in_review"] }, firstName: { equals: details.firstName, mode: "insensitive" }, lastName: { equals: details.lastName, mode: "insensitive" }, dateOfBirth: details.dateOfBirth }, select: { id: true } });
  if (duplicate) return { ok: false as const, error: "There is already an open referral for this person. Finish or close that one first." };
  const referral = await prisma.referral.create({ data: { organizationId: actor.organizationId, createdById: userId, ...details, officeNotes: null }, select: { id: true } });
  await auditAllowed(actor, "partner_referral_created", "referral", referral.id);
  return { ok: true as const, value: { referralId: referral.id } };
}

export async function listMyPartnerReferrals(userId: string) {
  await requirePermission(userId, "partner.referrals.read");
  const actor = await loadActor(userId);
  const rows = await prisma.referral.findMany({ where: { organizationId: actor.organizationId, createdById: userId }, select: { id: true, firstName: true, lastName: true, status: true, sourceType: true, requestedService: true, urgency: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map((row) => ({ ...row, sourceLabel: referralSourceLabel(row.sourceType), statusLabel: REFERRAL_STATUS_LABELS[row.status as keyof typeof REFERRAL_STATUS_LABELS] ?? "Received" }));
}
