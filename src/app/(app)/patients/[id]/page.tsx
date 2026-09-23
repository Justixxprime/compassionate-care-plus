import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ClipboardList, FileText, Inbox, UserRoundX } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getPatientDetail } from "@/lib/patients";
import { listCareTeam, getAssignmentOptions } from "@/lib/care-team";
import { listVisits } from "@/lib/visits";
import { listCarePlans } from "@/lib/care-plans";
import { listDocuments, type DocumentRow } from "@/lib/documents";
import { listReferrals } from "@/lib/referrals";
import {
  VISIT_STATUS_LABELS,
  actionsAvailableFor,
  visitTypeLabel,
  type VisitStatus,
} from "@/lib/visit-constants";
import { REFERRAL_STATUS_LABELS, type ReferralStatus } from "@/lib/referral-constants";
import { formatCalendarDate, formatOrgDate, formatOrgTimeRange } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { VisitActions } from "../../visits/visit-actions";
import { AssignTeamMemberForm } from "./assign-team-member-form";
import { EndAssignmentButton } from "./end-assignment-button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Patient profile" };

// One patient, everything about them a viewer's own reach already
// allows. This page composes six existing, independently permission-
// and reach-checked reads (getPatientDetail, listCareTeam, listVisits,
// listCarePlans, listDocuments, listReferrals) and filters four of them
// down to this one patientId - it never asks a new access question of
// its own. A section whose underlying permission this account lacks is
// simply left out (loadOptional below), the same "no section" pattern
// src/lib/app/dashboard.ts uses. The care team panel is the one part of
// this page that can actually CHANGE something (add or end an
// assignment); everything else here is read-only and links out to the
// screen that manages it.

const VISIT_STATUS_TONE: Record<VisitStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  missed: "danger",
};

const REFERRAL_STATUS_TONE: Record<ReferralStatus, NonNullable<BadgeProps["tone"]>> = {
  received: "warning",
  in_review: "info",
  accepted: "success",
  declined: "neutral",
  withdrawn: "neutral",
};

async function loadOptional<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AuthorizationError) return null;
    throw err;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;
  const user = await requireUser();

  // getPatientDetail is the hard stop: no patients.read, or this
  // patient is not one this account can reach, and the rest of the page
  // never runs. Not found and not reachable give the same NoAccess-style
  // screen on purpose - see src/lib/patients.ts.
  const patient = await loadOptional(() => getPatientDetail(user.id, patientId));
  if (!patient) return <NoAccess area="This patient" />;

  const [teamResult, visitLists, planLists, docs, referralLists, assignmentOptions] =
    await Promise.all([
      loadOptional(() => listCareTeam(user.id, patientId)),
      loadOptional(() => listVisits(user.id)),
      loadOptional(() => listCarePlans(user.id)),
      loadOptional(() => listDocuments(user.id)),
      loadOptional(() => listReferrals(user.id)),
      loadOptional(() => getAssignmentOptions(user.id, patientId)),
    ]);

  // listCareTeam returns Result<CareTeamView>: ok:false is a same-shape
  // refusal from inside the function (not an AuthorizationError throw),
  // so loadOptional alone does not collapse it - treat it the same way,
  // as "nothing to show for this section".
  const team = teamResult && teamResult.ok ? teamResult.value : null;

  const patientVisits = visitLists
    ? [...visitLists.upcoming, ...visitLists.recent]
        .filter((v) => v.patientId === patientId)
        .sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime())
    : null;

  const patientPlans = planLists
    ? [...planLists.current, ...planLists.past].filter((p) => p.patientId === patientId)
    : null;

  const patientDocs: DocumentRow[] | null = docs
    ? docs.filter((d) => d.patientId === patientId)
    : null;

  const linkedReferral = referralLists
    ? [...referralLists.open, ...referralLists.closed].find((r) => r.patientId === patientId) ??
      null
    : null;

  return (
    <>
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={`Born ${formatCalendarDate(patient.dateOfBirth)}. ${
          patient.status === "active" ? "Active patient." : `Status: ${patient.status}.`
        }`}
      />

      {team ? (
        <Section
          title="Care team"
          description="Who is currently assigned, and who has been. Ending an assignment does not cancel visits already on the calendar - those are reported separately for a human to reassign or cancel."
        >
          <div className="space-y-4">
            {team.active.length === 0 ? (
              <EmptyState icon={UserRoundX} title="Nobody is on this care team yet">
                Add someone below to give them access to this patient.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border bg-white">
                {team.active.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-ink">{m.name}</p>
                      <p className="text-body-sm text-slate">
                        {m.roleLabel} &middot; since {formatOrgDate(m.startsAt)}
                      </p>
                    </div>
                    {team.canManage ? (
                      <EndAssignmentButton
                        assignmentId={m.id}
                        patientId={patientId}
                        personName={m.name}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {team.past.length > 0 ? (
              <details className="rounded-md border border-border bg-white px-4 py-3">
                <summary className="cursor-pointer text-body-sm font-medium text-ink">
                  Past assignments ({team.past.length})
                </summary>
                <ul className="mt-3 divide-y divide-border">
                  {team.past.map((m) => (
                    <li key={m.id} className="py-2 text-body-sm text-slate">
                      {m.name} &middot; {m.roleLabel} &middot;{" "}
                      {formatOrgDate(m.startsAt)} to{" "}
                      {m.endsAt ? formatOrgDate(m.endsAt) : "?"}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {assignmentOptions ? (
              <div className="rounded-md border border-border bg-white p-4 sm:p-6">
                <h3 className="mb-3 text-body font-medium text-ink">Add to care team</h3>
                <AssignTeamMemberForm options={assignmentOptions} />
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {linkedReferral ? (
        <Section title="Referral">
          <Link
            href="/referrals"
            className="block rounded-md border border-border bg-white p-4 hover:bg-sage/40 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={REFERRAL_STATUS_TONE[linkedReferral.status as ReferralStatus] ?? "neutral"}>
                {REFERRAL_STATUS_LABELS[linkedReferral.status as ReferralStatus] ?? linkedReferral.status}
              </Badge>
              <span className="text-body-sm text-slate">
                {visitTypeLabel(linkedReferral.requestedService)}
              </span>
            </div>
            <p className="mt-2 text-body-sm text-slate">
              Recorded {formatOrgDate(linkedReferral.createdAt)} by {linkedReferral.createdByName}.
              View full details on the Referrals screen.
            </p>
          </Link>
        </Section>
      ) : null}

      {patientVisits ? (
        <Section title="Visits">
          {patientVisits.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No visits yet">
              Nothing has been scheduled for this patient.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-white">
              {patientVisits.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium tabular-nums text-ink">
                      {formatOrgDate(v.scheduledStart)}{" "}
                      <span className="font-normal text-slate">
                        {formatOrgTimeRange(v.scheduledStart, v.scheduledEnd)}
                      </span>
                    </p>
                    <p className="text-body-sm text-slate">
                      {visitTypeLabel(v.visitType)} with {v.clinicianName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={VISIT_STATUS_TONE[v.status as VisitStatus] ?? "neutral"}>
                      {VISIT_STATUS_LABELS[v.status as VisitStatus] ?? v.status}
                    </Badge>
                    {v.canChange && actionsAvailableFor(v.status).length > 0 ? (
                      <VisitActions visitId={v.id} status={v.status} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-body-sm text-slate">
            <Link href="/visits" className="text-pine underline-offset-2 hover:underline">
              Schedule a new visit
            </Link>{" "}
            from the Visits screen.
          </p>
        </Section>
      ) : null}

      {patientPlans ? (
        <Section title="Care plans">
          {patientPlans.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No care plan yet">
              A care plan can be written from the Care plans screen once someone is on this patient&apos;s team.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-white">
              {patientPlans.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={p.status === "active" ? "success" : p.status === "draft" ? "info" : "neutral"}>
                      {p.status}
                    </Badge>
                    <span className="font-medium text-ink">{p.title}</span>
                  </div>
                  <p className="mt-1 text-body-sm text-slate">
                    {p.goals.filter((g) => g.status === "met").length} of {p.goals.length} goals met
                    &middot; updated {formatOrgDate(p.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-body-sm text-slate">
            Manage plans and goals on the{" "}
            <Link href="/care-plans" className="text-pine underline-offset-2 hover:underline">
              Care plans screen
            </Link>
            .
          </p>
        </Section>
      ) : null}

      {patientDocs ? (
        <Section title="Documents">
          {patientDocs.length === 0 ? (
            <EmptyState icon={FileText} title="No documents on file">
              Nothing has been filed for this patient yet.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-white">
              {patientDocs.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{d.categoryLabel}</Badge>
                      {d.restricted ? <Badge tone="warning">Restricted</Badge> : null}
                    </div>
                    <p className="mt-1 text-body-sm text-ink">{d.title}</p>
                    <p className="text-caption text-slate">
                      {formatSize(d.sizeBytes)} &middot; filed {formatOrgDate(d.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`/documents/${d.id}/download`}
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-body-sm text-slate">
            File a new document from the{" "}
            <Link href="/documents" className="text-pine underline-offset-2 hover:underline">
              Documents screen
            </Link>
            .
          </p>
        </Section>
      ) : null}

      {!team && !patientVisits && !patientPlans && !patientDocs && !linkedReferral ? (
        <Section title="Nothing to show">
          <EmptyState icon={Inbox} title="This account cannot see anything else about this patient">
            Ask an administrator if you believe this is wrong.
          </EmptyState>
        </Section>
      ) : null}
    </>
  );
}
