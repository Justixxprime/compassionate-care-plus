// src/lib/app/dashboard-logic.ts
//
// The small decisions behind the dashboard, kept apart from the database so
// they can be tested with made-up rows (npm run verify:shell does that).
// Pure: no database, no "server-only".

import { orgDateKey } from "@/lib/time";
import { isOpenReferralStatus } from "@/lib/referral-constants";

// A referral that has waited longer than this is flagged.
export const LONG_WAIT_HOURS = 48;

export interface QueueReferral {
  status: string;
  urgency: string;
  createdAt: Date;
}

export interface ReferralQueueSummary {
  open: number;
  urgent: number;
  waitingLong: number;
  // When the longest-waiting open referral arrived, or null when none is open.
  oldestWaitingSince: Date | null;
}

// Counts the referrals still waiting for an answer. Closed ones (accepted,
// declined, withdrawn) are ignored even if they are passed in.
export function summarizeReferralQueue(
  rows: readonly QueueReferral[],
  now: Date,
): ReferralQueueSummary {
  const open = rows.filter((r) => isOpenReferralStatus(r.status));
  const limit = now.getTime() - LONG_WAIT_HOURS * 60 * 60 * 1000;
  const oldest = open.reduce<Date | null>(
    (acc, r) => (acc === null || r.createdAt < acc ? r.createdAt : acc),
    null,
  );
  return {
    open: open.length,
    urgent: open.filter((r) => r.urgency === "urgent").length,
    waitingLong: open.filter((r) => r.createdAt.getTime() < limit).length,
    oldestWaitingSince: oldest,
  };
}

// The visits that fall on today's office day, without the cancelled ones,
// soonest first. Works on anything with a start time and a status.
export function visitsOnOfficeDay<
  T extends { scheduledStart: Date; status: string },
>(rows: readonly T[], now: Date): T[] {
  const today = orgDateKey(now);
  return rows
    .filter((v) => v.status !== "cancelled" && orgDateKey(v.scheduledStart) === today)
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
}

export type AttentionTone = "danger" | "warning" | "info";

export interface AttentionItem {
  key: string;
  tone: AttentionTone;
  text: string;
  href: string;
}

// A count is null when the person has no way to see that kind of thing, and
// then it never appears. Zero never appears either: "0 urgent referrals"
// is not something that needs attention.
export interface AttentionInput {
  urgentReferrals: number | null;
  longWaitReferrals: number | null;
  overdueVisits: number | null;
  patientsWithoutPrimaryNurse: number | null;
  plansToApprove: number | null;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

// The list at the top of the dashboard, most serious first.
export function buildAttention(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const add = (
    count: number | null,
    item: Omit<AttentionItem, "text">,
    text: (n: number) => string,
  ) => {
    if (count !== null && count > 0) items.push({ ...item, text: text(count) });
  };

  add(input.urgentReferrals, { key: "urgent-referrals", tone: "danger", href: "/referrals" }, (n) =>
    `${n} urgent ${plural(n, "referral is", "referrals are")} waiting for an answer.`,
  );
  add(input.longWaitReferrals, { key: "long-wait-referrals", tone: "warning", href: "/referrals" }, (n) =>
    `${n} ${plural(n, "referral has", "referrals have")} waited more than ${LONG_WAIT_HOURS / 24} days.`,
  );
  add(input.overdueVisits, { key: "overdue-visits", tone: "warning", href: "/visits" }, (n) =>
    `${n} ${plural(n, "visit is", "visits are")} past ${plural(n, "its", "their")} time and never checked in.`,
  );
  add(input.patientsWithoutPrimaryNurse, { key: "no-primary-nurse", tone: "warning", href: "/patients" }, (n) =>
    `${n} ${plural(n, "patient has", "patients have")} no primary nurse.`,
  );
  add(input.plansToApprove, { key: "plans-to-approve", tone: "info", href: "/care-plans" }, (n) =>
    `${n} care ${plural(n, "plan is", "plans are")} waiting for approval.`,
  );
  return items;
}
