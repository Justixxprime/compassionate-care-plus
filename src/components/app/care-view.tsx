import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  VISIT_STATUS_LABELS,
  visitTypeLabel,
  type VisitStatus,
} from "@/lib/visit-constants";
import { formatOrgDate, formatOrgTimeRange } from "@/lib/time";
import type { MyCarePlan, MyTeamMember, MyVisit } from "@/lib/patient-view";

/*
  The pieces of a patient's care that the patient portal (/my-care) and the
  family portal (/family) both draw: a visit, the care team, the care plan.
  Drawing only. What each person may see is decided in
  src/lib/patient-portal.ts and src/lib/family-portal.ts before anything
  reaches these components, and they hold no ids of people, no e-mail
  addresses and nothing from a visit note.
*/

const STATUS_TONE: Record<VisitStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  missed: "danger",
};

export function VisitCard({ visit }: { visit: MyVisit }) {
  const status = visit.status as VisitStatus;
  return (
    <li className="rounded-md border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">
            {formatOrgDate(visit.scheduledStart)}
          </p>
          <p className="text-body-sm tabular-nums text-slate">
            {formatOrgTimeRange(visit.scheduledStart, visit.scheduledEnd)}
          </p>
          <p className="mt-2 text-body text-ink">{visitTypeLabel(visit.visitType)}</p>
          <p className="text-body-sm text-slate">With {visit.clinicianName}</p>
        </div>
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>
          {status === "in_progress"
            ? "Here now"
            : (VISIT_STATUS_LABELS[status] ?? visit.status)}
        </Badge>
      </div>
    </li>
  );
}

export function VisitList({ visits }: { visits: MyVisit[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {visits.map((v) => (
        <VisitCard key={v.id} visit={v} />
      ))}
    </ul>
  );
}

export function TeamGrid({ team }: { team: MyTeamMember[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {team.map((m, i) => (
        <li key={`${m.name}-${i}`} className="rounded-md border border-border bg-white p-4">
          <p className="text-body font-medium text-ink">{m.name}</p>
          <p className="text-body-sm text-slate">{m.roleLabel}</p>
        </li>
      ))}
    </ul>
  );
}

export function PlanCard({ plan }: { plan: MyCarePlan }) {
  return (
    <div className="rounded-md border border-border bg-white p-5">
      <h3 className="font-display text-h4 font-semibold text-ink">{plan.title}</h3>
      <p className="mt-2 text-body text-ink">{plan.summary}</p>
      {plan.goals.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {plan.goals.map((g) => (
            <li key={g.id} className="flex items-start justify-between gap-3">
              <span className="text-body-sm text-ink">{g.description}</span>
              <Badge tone={g.met ? "success" : "neutral"}>
                {g.met ? "Done" : "Working on it"}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
