import type { Metadata } from "next";
import { CalendarDays, ClipboardList, Info, Users } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getMyCare, type MyCare, type MyVisit } from "@/lib/patient-portal";
import {
  VISIT_STATUS_LABELS,
  visitTypeLabel,
  type VisitStatus,
} from "@/lib/visit-constants";
import { formatOrgDate, formatOrgTimeRange } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";

export const metadata: Metadata = { title: "My care" };

const STATUS_TONE: Record<VisitStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  missed: "danger",
};

function VisitCard({ visit }: { visit: MyVisit }) {
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

export default async function MyCarePage() {
  // Every page asks who is asking by itself; the shell is not the lock.
  const user = await requireUser();

  let care: MyCare | null;
  try {
    care = await getMyCare(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="My care" />;
    throw err;
  }

  if (!care) {
    return (
      <>
        <PageHeader title="My care" />
        <div className="mt-6">
          <EmptyState icon={Info} title="Your account is not connected to a care record yet.">
            The office connects your account to your record. Please call the office and
            ask them to do this.
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Hello, ${care.firstName}`}
        description="Your next visits, the people looking after you and your care plan. Times are office time (Central). To change or cancel a visit, call the office."
      />

      <Section title="Your next visits">
        {care.upcoming.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No visits are scheduled right now">
            When the office schedules a visit, it appears here.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {care.upcoming.map((v) => (
              <VisitCard key={v.id} visit={v} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="The people looking after you">
        {care.team.length === 0 ? (
          <EmptyState icon={Users} title="Your care team is being put together">
            Names appear here as soon as the office adds them.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {care.team.map((m, i) => (
              <li key={`${m.name}-${i}`} className="rounded-md border border-border bg-white p-4">
                <p className="text-body font-medium text-ink">{m.name}</p>
                <p className="text-body-sm text-slate">{m.roleLabel}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Your care plan">
        {care.plan ? (
          <div className="rounded-md border border-border bg-white p-5">
            <h3 className="font-display text-h4 font-semibold text-ink">{care.plan.title}</h3>
            <p className="mt-2 text-body text-ink">{care.plan.summary}</p>
            {care.plan.goals.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {care.plan.goals.map((g) => (
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
        ) : (
          <EmptyState icon={ClipboardList} title="Your care plan is not ready yet">
            Your nurse writes it, and it appears here once it has been approved.
          </EmptyState>
        )}
      </Section>

      {care.recent.length > 0 ? (
        <Section title="Recent visits">
          <ul className="flex flex-col gap-3">
            {care.recent.map((v) => (
              <VisitCard key={v.id} visit={v} />
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
