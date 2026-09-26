// Password recovery is deliberately isolated from sign-in. The browser sees
// only generic success messages; reset secrets exist only in the e-mail link,
// never in the database, logs, notifications, or Server Action response.

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { isPlausibleEmail, normalizeEmail, passwordProblem } from "@/lib/account-constants";

const RESET_LIFETIME_MS = 1000 * 60 * 20;
const REQUEST_WINDOW_MS = 1000 * 60 * 15;
const MAX_REQUESTS_PER_WINDOW = 3;
const BCRYPT_COST = 12;
const GENERIC_MESSAGE =
  "If that address can receive recovery messages, a link will arrive shortly.";

function identifierHash(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function recoveryEmailReady(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM_EMAIL &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

function resetLink(token: string): string | null {
  try {
    const base = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
    if (base.protocol !== "https:" && base.hostname !== "localhost") return null;
    base.pathname = "/reset-password";
    base.search = new URLSearchParams({ token }).toString();
    return base.toString();
  } catch {
    return null;
  }
}

async function sendRecoveryEmail(to: string, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your Cheliv password",
      html: `<p>A password reset was requested for your Cheliv account.</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in 20 minutes. If you did not request it, you can ignore this message.</p>`,
    }),
    cache: "no-store",
  });
  return response.ok;
}

export interface RecoveryRequestResult {
  message: string;
}

export async function requestPasswordRecovery(rawEmail: string): Promise<RecoveryRequestResult> {
  const email = normalizeEmail(rawEmail);
  // Keep invalid, missing, unknown, rate-limited, and disabled delivery
  // indistinguishable. This endpoint must not become an account directory.
  if (!isPlausibleEmail(email) || !recoveryEmailReady()) return { message: GENERIC_MESSAGE };

  const hash = identifierHash(email);
  const now = new Date();
  const since = new Date(now.getTime() - REQUEST_WINDOW_MS);
  const recent = await prisma.passwordResetRequest.count({
    where: { identifierHash: hash, occurredAt: { gte: since } },
  });
  if (recent >= MAX_REQUESTS_PER_WINDOW) return { message: GENERIC_MESSAGE };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, organizationId: true },
  });
  await prisma.passwordResetRequest.create({
    data: { identifierHash: hash, userId: user?.id },
  });
  if (!user) return { message: GENERIC_MESSAGE };

  const token = randomBytes(32).toString("base64url");
  const link = resetLink(token);
  if (!link) return { message: GENERIC_MESSAGE };

  // Only one reset link survives per account. Replacing a prior unused link
  // makes an accidentally forwarded or delayed older e-mail harmless.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const reset = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash(token),
      expiresAt: new Date(now.getTime() + RESET_LIFETIME_MS),
    },
  });

  const delivered = await sendRecoveryEmail(user.email, link).catch(() => false);
  if (!delivered) {
    // A link that was not handed to the account holder must not remain valid.
    await prisma.passwordResetToken.delete({ where: { id: reset.id } }).catch(() => {});
    await writeAuditLog({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: "password_reset_delivery_failed",
      outcome: "denied",
    });
    return { message: GENERIC_MESSAGE };
  }

  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: "password_reset_requested",
    outcome: "allowed",
  });
  return { message: GENERIC_MESSAGE };
}

export interface PasswordResetResult {
  ok: boolean;
  error?: string;
}

export async function resetPassword(
  token: string,
  password: string,
  confirmPassword: string,
): Promise<PasswordResetResult> {
  if (!token || token.length > 200) return { ok: false, error: "That reset link is invalid or has expired." };
  if (password !== confirmPassword) return { ok: false, error: "The two passwords do not match." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  const now = new Date();
  const reset = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: tokenHash(token), usedAt: null, expiresAt: { gt: now } },
    select: { id: true, userId: true, user: { select: { email: true, organizationId: true } } },
  });
  if (!reset) return { ok: false, error: "That reset link is invalid or has expired." };

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const consumed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    // Password replacement is an account-compromise response: every device
    // must authenticate again, including the browser that requested the link.
    await tx.session.deleteMany({ where: { userId: reset.userId } });
    // A password-verified MFA checkpoint is not a session, but it must not
    // survive a password reset either.
    await tx.mfaChallenge.deleteMany({ where: { userId: reset.userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId, id: { not: reset.id } } });
    return true;
  });
  if (!consumed) return { ok: false, error: "That reset link is invalid or has expired." };

  await writeAuditLog({
    organizationId: reset.user.organizationId,
    actorUserId: reset.userId,
    actorEmail: reset.user.email,
    action: "password_reset_completed",
    outcome: "allowed",
  });
  return { ok: true };
}
