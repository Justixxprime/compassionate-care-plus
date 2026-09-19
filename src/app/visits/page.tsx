import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  getSchedulingOptions,
  listVisits,
  type VisitLists,
  type VisitRow,
} from "@/lib/visits";
import {
  VISIT_STATUS_LABELS,
  visitTypeLabel,
  type VisitStatus,
} from "@/lib/visit-constants";
import { formatOrgDate, formatOrgTimeRange } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ScheduleVisitForm } from "./schedule-visit-form";
import { VisitActions } from "./visit-actions";

// Deliberately plain, like /dashboard and /patients - this exists to prove
// visit access works end to end (permission AND relationship, for reading,
// scheduling and changing), not to be the real scheduling board. The real
// day and week calendar is Milestone E.

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

function VisitList({
  title,
  visits,
  emptyText,
}: {
  title: string;
  visits: VisitRow[];
  emptyText: string;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-h3 text-ink">{title}</h2>
      <div className="mt-4 divide-y divide-border border-y border-border">
        {visits.length === 0 ? (
          <p className="py-6 text-body-sm text-slate">{emptyText}</p>
        ) : (
          visits.map((visit) => (
            <div
              key={visit.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="text-data font-medium text-ink">
                  {formatOrgDate(visit.scheduledStart)}
                  <span className="text-slate">
                    {" "}
                    &middot;{" "}
                    {formatOrgTimeRange(visit.scheduledStart, visit.scheduledEnd)}
                  </span>
                </p>
                <p className="mt-1 text-body text-ink">{visit.patientName}</p>
                <p className="mt-0.5 text-body-sm text-slate">
                  {visitTypeLabel(visit.visitType)} with {visit.clinicianName}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={statusTone(visit.status)}>
                    {statusLabel(visit.status)}
                  </Badge>
                  {visit.overdue ? <Badge tone="warning">Overdue</Badge> : null}
                </div>
              </div>

              {visit.canChange ? (
                <VisitActions visitId={visit.id} status={visit.status} />
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default async function VisitsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // listVisits calls requirePermission first. An account without
  // visits.read gets a plain explanation rather than a crash - the denial
  // itself is already in the audit log by the time this catch runs.
  let lists: VisitLists;
  try {
    lists = await listVisits(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-20">
          <h1 className="font-display text-h1 text-ink">Visits</h1>
          <p className="mt-4 text-body text-slate">
            Your account does not have access to visits.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-block text-body-sm font-medium text-pine hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      );
    }
    throw err;
  }

  const options = await getSchedulingOptions(user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
        Visits
      </p>
      <h1 className="mt-3 font-display text-h1 text-ink">Visits you can see</h1>
      <p className="mt-3 max-w-xl text-body text-slate">
        Like patients, this list depends on who is signed in. An
        administrative role sees every visit in the organization. A clinical
        role sees the visits of the patients they are assigned to, and can
        only change their own. All times are office time (Central).
      </p>

      {options !== null ? (
        <section className="mt-10 rounded-md border border-border bg-white p-6">
          <h2 className="font-display text-h3 text-ink">Schedule a visit</h2>
          {options.length === 0 ? (
            <p className="mt-3 text-body-sm text-slate">
              No patients are available to schedule right now. A visit needs an
              active patient with someone on their care team.
            </p>
          ) : (
            <div className="mt-5">
              <ScheduleVisitForm options={options} />
            </div>
          )}
        </section>
      ) : null}

      <VisitList
        title="Upcoming and in progress"
        visits={lists.upcoming}
        emptyText="No upcoming visits for this account."
      />
      <VisitList
        title="Recent"
        visits={lists.recent}
        emptyText="No completed, cancelled or missed visits yet."
      />

      <div className="mt-12 flex gap-6">
        <Link
          href="/dashboard"
          className="text-body-sm font-medium text-pine hover:underline"
        >
          Back to dashboard
        </Link>
        <Link
          href="/patients"
          className="text-body-sm font-medium text-pine hover:underline"
        >
          Patients
        </Link>
      </div>
    </div>
  );
}
