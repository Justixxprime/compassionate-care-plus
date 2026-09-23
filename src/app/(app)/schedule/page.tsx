import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { listVisits, getSchedulingOptions, type VisitLists } from "@/lib/visits";
import {
  VISIT_STATUS_LABELS,
  actionsAvailableFor,
  visitTypeLabel,
  type VisitStatus,
} from "@/lib/visit-constants";
import { orgDateKey, formatOrgTime } from "@/lib/time";
import {
  addDaysToKey,
  buildScheduleWeek,
  isDateKey,
  mondayOfWeekContaining,
} from "@/lib/app/schedule-logic";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { NoAccess } from "@/components/app/no-access";
import { cn } from "@/lib/cn";
import { ScheduleVisitForm } from "../visits/schedule-visit-form";
import { VisitActions } from "../visits/visit-actions";

export const metadata: Metadata = { title: "Scheduling board" };

// A week at a glance, grouped by day, across every clinician this
// account can see. Built entirely on listVisits and getSchedulingOptions
// (both already permission- and reach-checked) - this page adds no new
// database query and no new access rule, only the weekly layout. The
// grouping itself lives in src/lib/app/schedule-logic.ts as pure
// functions, tested the same way dashboard-logic.ts is.

const STATUS_TONE: Record<VisitStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  missed: "danger",
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireUser();

  let lists: VisitLists;
  try {
    lists = await listVisits(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Scheduling board" />;
    throw err;
  }

  const options = await getSchedulingOptions(user.id);

  const { week } = await searchParams;
  const todayKey = orgDateKey(new Date());
  const requestedKey = week && isDateKey(week) ? week : todayKey;
  const mondayKey = mondayOfWeekContaining(requestedKey);
  const days = buildScheduleWeek([...lists.upcoming, ...lists.recent], mondayKey, todayKey);
  const prevWeek = addDaysToKey(mondayKey, -7);
  const nextWeek = addDaysToKey(mondayKey, 7);
  const thisWeek = mondayOfWeekContaining(todayKey);

  return (
    <>
      <PageHeader
        title="Scheduling board"
        description="Every visit this account can see, Monday through Sunday. Administrative roles see the whole organization; everyone else sees their own assigned patients' visits."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/schedule?week=${prevWeek}`} className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}>
          Previous week
        </Link>
        <Link href={`/schedule?week=${thisWeek}`} className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}>
          This week
        </Link>
        <Link href={`/schedule?week=${nextWeek}`} className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}>
          Next week
        </Link>
      </div>

      {options && options.length > 0 ? (
        <Section title="Schedule a visit">
          <div className="rounded-md border border-border bg-white p-4 sm:p-6">
            <ScheduleVisitForm options={options} />
          </div>
        </Section>
      ) : null}

      <Section title="Week">
        <div className="grid gap-3 lg:grid-cols-7">
          {days.map((day) => (
            <div
              key={day.dateKey}
              className={cn(
                "rounded-md border bg-white p-3",
                day.isToday ? "border-pine" : "border-border",
              )}
            >
              <h3 className="text-body-sm font-semibold text-ink">
                {day.label}
                {day.isToday ? <span className="ml-1 text-caption text-pine">Today</span> : null}
              </h3>
              {day.visits.length === 0 ? (
                <p className="mt-2 text-caption text-slate">No visits</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {day.visits.map((v) => (
                    <li
                      key={v.id}
                      className="rounded-md border border-border bg-sage/30 p-2 text-caption"
                    >
                      <p className="font-medium tabular-nums text-ink">
                        {formatOrgTime(v.scheduledStart)} {v.patientName}
                      </p>
                      <p className="text-slate">
                        {visitTypeLabel(v.visitType)} &middot; {v.clinicianName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={STATUS_TONE[v.status as VisitStatus] ?? "neutral"}>
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
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
