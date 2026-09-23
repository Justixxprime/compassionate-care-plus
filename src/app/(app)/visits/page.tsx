import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  getSchedulingOptions,
  listVisits,
  type VisitLists,
  type VisitRow,
} from "@/lib/visits";
import {
  listNotesPendingReview,
  listVisitsNeedingDocumentation,
} from "@/lib/visit-notes";
import {
  VISIT_STATUS_LABELS,
  actionsAvailableFor,
  visitTypeLabel,
  type VisitStatus,
} from "@/lib/visit-constants";
import { formatOrgDate, formatOrgTimeRange } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { DataTable, type Column } from "@/components/app/data-table";
import { NoAccess } from "@/components/app/no-access";
import { ScheduleVisitForm } from "./schedule-visit-form";
import { VisitActions } from "./visit-actions";

export const metadata: Metadata = { title: "Visits" };

const STATUS_TONE: Record<VisitStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  missed: "danger",
};

function statusLabel(status: string) {
  return VISIT_STATUS_LABELS[status as VisitStatus] ?? status;
}

function statusTone(status: string) {
  return STATUS_TONE[status as VisitStatus] ?? "neutral";
}

// The same columns for both lists, so the two tables line up.
const visitColumns: Column<VisitRow>[] = [
  {
    key: "when",
    header: "When",
    cell: (v) => (
      <Link href={`/visits/${v.id}`} className="hover:underline">
        <span className="font-medium tabular-nums">{formatOrgDate(v.scheduledStart)}</span>
        <span className="block text-slate tabular-nums">
          {formatOrgTimeRange(v.scheduledStart, v.scheduledEnd)}
        </span>
      </Link>
    ),
  },
  { key: "patient", header: "Patient", cell: (v) => v.patientName },
  {
    key: "visit",
    header: "Visit",
    cell: (v) => (
      <>
        {visitTypeLabel(v.visitType)}
        <span className="block text-slate">with {v.clinicianName}</span>
      </>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (v) => (
      <span className="flex flex-wrap gap-1.5">
        <Badge tone={statusTone(v.status)}>{statusLabel(v.status)}</Badge>
        {v.overdue ? <Badge tone="warning">Overdue</Badge> : null}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    alignRight: true,
    hideLabelOnCard: true,
    // Whether this person may press these was decided on the server, and
    // changeVisitStatus checks again on every click.
    cell: (v) =>
      v.canChange && actionsAvailableFor(v.status).length > 0 ? (
        <VisitActions visitId={v.id} status={v.status} />
      ) : null,
  },
];

export default async function VisitsPage() {
  const user = await requireUser();

  // listVisits calls requirePermission first. An account without
  // visits.read gets a plain explanation rather than a crash, and the
  // refusal is already in the audit log by the time this catch runs.
  let lists: VisitLists;
  try {
    lists = await listVisits(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Visits" />;
    throw err;
  }

  const options = await getSchedulingOptions(user.id);
  const [needsDocumentation, pendingReview] = await Promise.all([
    listVisitsNeedingDocumentation(user.id),
    listNotesPendingReview(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Visits"
        description="Administrative roles see every visit. A clinical role sees the visits of the patients they are assigned to and can change only their own. All times are office time (Central)."
      />

      {needsDocumentation.length > 0 ? (
        <Section
          title="Needs your documentation"
          description="Visits you finished that have no note yet."
        >
          <ul className="divide-y divide-border rounded-md border border-border bg-white">
            {needsDocumentation.map((v) => (
              <li key={v.visitId} className="p-4">
                <Link href={`/visits/${v.visitId}`} className="font-medium hover:underline">
                  {v.patientName} - {visitTypeLabel(v.visitType)}
                </Link>
                <span className="block text-body-sm text-slate">
                  {formatOrgDate(v.scheduledStart)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {pendingReview.length > 0 ? (
        <Section
          title="Notes waiting on review"
          description="Submitted by someone else, waiting for a reviewer."
        >
          <ul className="divide-y divide-border rounded-md border border-border bg-white">
            {pendingReview.map((v) => (
              <li key={v.visitId} className="p-4">
                <Link href={`/visits/${v.visitId}`} className="font-medium hover:underline">
                  {v.patientName} - {visitTypeLabel(v.visitType)}
                </Link>
                <span className="block text-body-sm text-slate">
                  {formatOrgDate(v.scheduledStart)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {options !== null ? (
        <Section
          title="Schedule a visit"
          description="A visit needs an active patient with someone on their care team."
        >
          {options.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No patient can be scheduled right now">
              Put someone on a patient&apos;s care team first, then come back here.
            </EmptyState>
          ) : (
            <div className="rounded-md border border-border bg-white p-4 sm:p-6">
              <ScheduleVisitForm options={options} />
            </div>
          )}
        </Section>
      ) : null}

      <Section title="Upcoming and in progress">
        <DataTable
          caption="Upcoming and in-progress visits"
          rows={lists.upcoming}
          rowKey={(v) => v.id}
          columns={visitColumns}
          empty={
            <EmptyState icon={CalendarDays} title="No upcoming visits">
              Nothing is scheduled for this account.
            </EmptyState>
          }
        />
      </Section>

      <Section title="Recent">
        <DataTable
          caption="Completed, cancelled and missed visits"
          rows={lists.recent}
          rowKey={(v) => v.id}
          columns={visitColumns}
          empty={
            <EmptyState title="No finished visits yet">
              Completed, cancelled and missed visits will appear here.
            </EmptyState>
          }
        />
      </Section>
    </>
  );
}
