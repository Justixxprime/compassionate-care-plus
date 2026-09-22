// src/lib/app/dashboard.ts
//
// What the dashboard shows one person. It is built from the SAME service
// functions the other screens use (listVisits, listReferrals, listCarePlans,
// listPatientsNeedingTeam, getAccessiblePatients), so a dashboard can never
// show anybody something their own screens would refuse to show. It has no
// query of its own for patient information and decides no access of its own.
//
// Each section is gated by a PERMISSION, not by a role name. That is what
// makes the dashboard "per role" without a list of roles to keep in step
// with the permission sets: give a role a permission and its dashboard
// grows the matching section.
//
//   visits.read                      today's visits, overdue visits
//   referrals.manage (+ reach)       open referrals and how long they wait
//   care_team.read                   patients who still need a primary nurse
//   care_plans.approve + read        care plans waiting for approval
//   patients.read                    how many patients
//   audit.read                       recent activity
//
// A section the person cannot see is null: never computed, never sent.
//
// The audit log is not read here for anyone without audit.read, and nothing
// on this page records what a record said, only counts and names the
// person's own screens already show them.

import "server-only";
import { getAccessiblePatients } from "@/lib/patients";
import { listVisits, type VisitRow } from "@/lib/visits";
import { listReferrals, type ReferralRow } from "@/lib/referrals";
import { listCarePlans, type CarePlanRow } from "@/lib/care-plans";
import { listPatientsNeedingTeam, type PatientNeedingTeam } from "@/lib/care-team";
import { getRecentAuditLog } from "@/lib/audit/log";
import {
  buildAttention,
  summarizeReferralQueue,
  visitsOnOfficeDay,
  type AttentionItem,
  type ReferralQueueSummary,
} from "@/lib/app/dashboard-logic";

// How many rows each dashboard list shows. The full list is one click away.
const LIST_LIMIT = 5;

export interface DashboardTile {
  key: string;
  label: string;
  value: number;
  hint: string | null;
  href: string;
}

export interface DashboardData {
  attention: AttentionItem[];
  tiles: DashboardTile[];
  // null means "this person has no such section", not "nothing to show".
  todaysVisits: VisitRow[] | null;
  referrals: { summary: ReferralQueueSummary; rows: ReferralRow[] } | null;
  needsPrimaryNurse: PatientNeedingTeam[] | null;
  plansToApprove: CarePlanRow[] | null;
  recentActivity: Awaited<ReturnType<typeof getRecentAuditLog>> | null;
}

export async function getDashboardData(
  userId: string,
  permissions: ReadonlySet<string>,
  now: Date = new Date(),
): Promise<DashboardData> {
  const can = (key: string) => permissions.has(key);

  const [patients, visitLists, referralLists, needsTeam, planLists, activity] =
    await Promise.all([
      can("patients.read") ? getAccessiblePatients(userId) : null,
      can("visits.read") ? listVisits(userId) : null,
      can("referrals.manage") ? listReferrals(userId) : null,
      can("care_team.read") ? listPatientsNeedingTeam(userId) : null,
      can("care_plans.read") && can("care_plans.approve")
        ? listCarePlans(userId)
        : null,
      can("audit.read") ? getRecentAuditLog(8) : null,
    ]);

  // ----- visits -----
  const todaysVisits = visitLists
    ? visitsOnOfficeDay([...visitLists.upcoming, ...visitLists.recent], now)
    : null;
  const overdueVisits = visitLists
    ? visitLists.upcoming.filter((v) => v.overdue).length
    : null;

  // ----- referrals -----
  // Only someone whose reach includes people who are not patients yet
  // (canManage) has a referral queue. A nurse sees referrals of her own
  // patients on the referrals screen, and they are all closed, so there is
  // no queue to show her.
  const queue =
    referralLists && referralLists.canManage
      ? {
          summary: summarizeReferralQueue(referralLists.open, now),
          rows: referralLists.open.slice(0, LIST_LIMIT),
        }
      : null;

  // ----- care plans -----
  const plansToApprove = planLists
    ? planLists.current.filter((p) => p.status === "draft" && p.canApprove)
    : null;

  const attention = buildAttention({
    urgentReferrals: queue ? queue.summary.urgent : null,
    longWaitReferrals: queue ? queue.summary.waitingLong : null,
    overdueVisits,
    patientsWithoutPrimaryNurse: needsTeam ? needsTeam.length : null,
    plansToApprove: plansToApprove ? plansToApprove.length : null,
  });

  // ----- tiles -----
  const tiles: DashboardTile[] = [];
  if (todaysVisits) {
    const todo = todaysVisits.filter(
      (v) => v.status === "scheduled" || v.status === "in_progress",
    ).length;
    tiles.push({
      key: "visits-today",
      label: "Visits today",
      value: todaysVisits.length,
      hint: todaysVisits.length === 0 ? "None scheduled" : `${todo} still to do`,
      href: "/visits",
    });
  }
  if (queue) {
    tiles.push({
      key: "open-referrals",
      label: "Open referrals",
      value: queue.summary.open,
      hint: queue.summary.urgent > 0 ? `${queue.summary.urgent} urgent` : "None urgent",
      href: "/referrals",
    });
  }
  if (needsTeam) {
    tiles.push({
      key: "need-nurse",
      label: "Need a primary nurse",
      value: needsTeam.length,
      hint: needsTeam.length === 0 ? "Every patient has one" : "Patients without one",
      href: "/patients",
    });
  }
  if (plansToApprove) {
    tiles.push({
      key: "plans-to-approve",
      label: "Plans to approve",
      value: plansToApprove.length,
      hint: plansToApprove.length === 0 ? "Nothing waiting" : "Drafts you may approve",
      href: "/care-plans",
    });
  }
  if (patients) {
    tiles.push({
      key: "patients",
      label: "Patients",
      value: patients.length,
      hint: null,
      href: "/patients",
    });
  }

  return {
    attention,
    tiles,
    todaysVisits,
    referrals: queue,
    needsPrimaryNurse: needsTeam ? needsTeam.slice(0, LIST_LIMIT) : null,
    plansToApprove: plansToApprove ? plansToApprove.slice(0, LIST_LIMIT) : null,
    recentActivity: activity,
  };
}
