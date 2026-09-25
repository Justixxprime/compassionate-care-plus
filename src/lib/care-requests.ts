// src/lib/care-requests.ts
//
// The public "Request care" form (src/components/marketing/request-care-form.tsx)
// and the admin screen that manages what comes in (src/app/(app)/care-requests).
//
// THIS IS THE ONE PLACE IN THE WHOLE SCHEMA A SIGNED-OUT STRANGER CAN
// WRITE A ROW. Everything else in this project asks "who is this?"
// first. This file cannot ask that question - there is no session -
// so it asks different questions instead: is the shape of what was
// typed plausible, and is the honeypot field still empty (a field a
// real visitor never sees or fills, left on by an automated bot).
//
// createCareRequest is deliberately NOT wired to send a real e-mail.
// There is no e-mail service configured yet - PHASE_0_ARCHITECTURE.md's
// stack lists Nodemailer for that, and this project's standing rule is
// "no new dependency without asking first" (docs/CONTINUATION_PROMPT.md).
// So what happens today is the two things that need nothing new: the
// request is SAVED (never silently lost, which is the gap this round
// closes) and every ADMIN/SUPER_ADMIN gets an in-app notification
// through the existing bell (src/lib/notifications.ts). See
// docs/CARE_REQUESTS.md for the honest account of what is and is not
// wired up, and what real delivery would need.
//
// Reading and acting on requests IS a normal permission-checked
// operation, same shape as every other admin screen:
//   1. PERMISSION   care_requests.manage (requirePermission, a hard stop)
//   2. ORGANIZATION scoped to the caller's own organization, same as
//                   every other list in this project
// There is no relationship question here - a care request has no
// patient yet, and every ADMIN/SUPER_ADMIN in the organization may see
// every one, the same reasoning src/lib/referrals.ts uses for an
// unlinked referral.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { writeAuditLog } from "@/lib/audit/log";
import { auditAllowed, loadActor } from "@/lib/auth/actor";
import { notifyUser } from "@/lib/notifications";
import type { Result } from "@/lib/visits";
import {
  CARE_REQUEST_TRANSITIONS,
  CONTACT_MAX,
  MESSAGE_MAX,
  NAME_MAX,
  RELATIONSHIP_OPTIONS,
  careRequestNotifyEmail,
  isCareRequestAction,
  isPlausibleEmail,
  isPreferredContact,
  normalizeEmail,
} from "@/lib/care-request-constants";

const GENERIC_ERROR =
  "Something went wrong sending that. Please try again, or call the office directly.";
const NOT_FOUND = "That request could not be found.";

// ---------- Submitting (public, no session) ----------

export interface SubmitCareRequestInput {
  fullName: string;
  relationship: string;
  email: string;
  phone: string;
  preferredContact: string;
  serviceInterest: string; // "" is fine - "not sure yet" on the form
  bestTime: string;
  message: string;
  // A field the form keeps visually empty and off the tab order. A
  // real person never types into it; a script filling in every field
  // it finds does. Not a security control against a determined
  // attacker, just a cheap, honest filter against the ordinary spam
  // this form will otherwise collect - see docs/CARE_REQUESTS.md.
  honeypot: string;
}

export async function createCareRequest(
  input: SubmitCareRequestInput,
): Promise<Result<{ id: string }>> {
  // A filled honeypot looks exactly like success to whatever sent it,
  // and writes nothing - there is no person here to tell the truth to.
  if (input.honeypot.trim() !== "") {
    return { ok: true, value: { id: "" } };
  }

  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Enter your name." };
  if (fullName.length > NAME_MAX) return { ok: false, error: "That name is too long." };

  if (!(RELATIONSHIP_OPTIONS as readonly string[]).includes(input.relationship)) {
    return { ok: false, error: "Choose a relationship to the patient." };
  }

  const email = normalizeEmail(input.email);
  if (!isPlausibleEmail(email) || email.length > CONTACT_MAX) {
    return { ok: false, error: "Enter a valid e-mail address." };
  }

  const phone = input.phone.trim();
  if (!phone) return { ok: false, error: "Enter a phone number." };
  if (phone.length > CONTACT_MAX) return { ok: false, error: "That phone number is too long." };

  if (!isPreferredContact(input.preferredContact)) {
    return { ok: false, error: "Choose a preferred contact method." };
  }

  const message = input.message.trim();
  if (message.length > MESSAGE_MAX) {
    return { ok: false, error: "That message is too long. Please shorten it." };
  }

  // Single organization today. A form with no session cannot ask "which
  // organization is this?" the way every signed-in action does (it
  // reads that from the actor's own row) - if this project ever serves
  // more than one organization, this is the one place that needs a real
  // answer to "which one", most likely from the domain the form was
  // loaded on. Documented here rather than guessed at.
  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) {
    console.error("createCareRequest: no organization exists yet");
    return { ok: false, error: GENERIC_ERROR };
  }

  const notifyEmail = careRequestNotifyEmail();

  try {
    const created = await prisma.careRequest.create({
      data: {
        organizationId: org.id,
        fullName,
        relationship: input.relationship,
        email,
        phone,
        preferredContact: input.preferredContact,
        serviceInterest: input.serviceInterest.trim() || null,
        bestTime: input.bestTime.trim() || "Anytime",
        message: message || null,
        notifyEmail,
      },
      select: { id: true },
    });

    // Best effort, exactly like every other notification and audit
    // write in this project: a failure here must never be the reason
    // the person submitting the form sees an error, since their request
    // is already safely saved by this point.
    await writeAuditLog({
      organizationId: org.id,
      action: "care_request_received",
      resourceType: "care_request",
      resourceId: created.id,
      outcome: "allowed",
    });

    const recipients = await prisma.user.findMany({
      where: {
        organizationId: org.id,
        userRoles: {
          some: { role: { rolePermissions: { some: { permission: { key: "care_requests.manage" } } } } },
        },
      },
      select: { id: true },
    });
    for (const r of recipients) {
      await notifyUser({
        organizationId: org.id,
        userId: r.id,
        kind: "care_request_received",
        resourceType: "care_request",
        resourceId: created.id,
      });
    }

    return { ok: true, value: { id: created.id } };
  } catch (err) {
    console.error("Failed to save care request:", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ---------- Reading and acting (staff, care_requests.manage) ----------

export interface CareRequestRow {
  id: string;
  fullName: string;
  relationship: string;
  email: string;
  phone: string;
  preferredContact: string;
  serviceInterest: string | null;
  bestTime: string;
  message: string | null;
  notifyEmail: string;
  status: string;
  contactedByName: string | null;
  contactedAt: Date | null;
  createdAt: Date;
}

const LIST_LIMIT = 200;

export async function listCareRequests(userId: string): Promise<CareRequestRow[]> {
  await requirePermission(userId, "care_requests.manage");
  const actor = await loadActor(userId);

  const rows = await prisma.careRequest.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    include: { contactedBy: { select: { name: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    relationship: r.relationship,
    email: r.email,
    phone: r.phone,
    preferredContact: r.preferredContact,
    serviceInterest: r.serviceInterest,
    bestTime: r.bestTime,
    message: r.message,
    notifyEmail: r.notifyEmail,
    status: r.status,
    contactedByName: r.contactedBy?.name ?? null,
    contactedAt: r.contactedAt,
    createdAt: r.createdAt,
  }));
}

export async function changeCareRequestStatus(
  userId: string,
  requestId: string,
  action: string,
): Promise<Result<{ id: string }>> {
  await requirePermission(userId, "care_requests.manage");
  const actor = await loadActor(userId);

  if (!isCareRequestAction(action)) {
    return { ok: false, error: "That is not a recognized action." };
  }
  const { to, auditAction } = CARE_REQUEST_TRANSITIONS[action];

  const row = await prisma.careRequest.findFirst({
    where: { id: requestId, organizationId: actor.organizationId },
    select: { id: true, status: true },
  });
  if (!row) {
    await writeAuditLog({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "access_denied",
      resourceType: "care_request",
      resourceId: requestId,
      outcome: "denied",
    });
    return { ok: false, error: NOT_FOUND };
  }
  if (row.status === "closed") {
    return { ok: false, error: "This request is already closed." };
  }
  if (row.status === to) {
    return { ok: false, error: `This request is already marked ${to}.` };
  }

  await prisma.careRequest.update({
    where: { id: row.id },
    data:
      action === "contact"
        ? { status: "contacted", contactedById: actor.id, contactedAt: new Date() }
        : { status: "closed" },
  });

  await auditAllowed(actor, auditAction, "care_request", row.id);
  return { ok: true, value: { id: row.id } };
}
