import type { Metadata } from "next";
import { CalendarCheck, ListChecks } from "lucide-react";
import { getRequestPermissions, requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getCaregiverDay, type CaregiverDay, type CaregiverVisit } from "@/lib/caregiver";
import { listTasks, type TaskRow } from "@/lib/tasks";
import {
  VISIT_STATUS_LABELS,
  visitTypeLabel,
  type VisitStatus,
} from "@/lib/visit-constants";
import { formatCalendarDate, formatOrgDate, formatOrgTime, formatOrgTimeRange } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { CaregiverVisitUpdateForm, TaskDoneButton, VisitButton } from "./caregiver-controls";

export const metadata: Metadata = { title: "My day" };

const STATUS_TONE: Record<VisitStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  missed: "danger",
};

function VisitCard({ visit, canDocument }: { visit: CaregiverVisit; canDocument: boolean }) {
  const status = visit.status as VisitStatus;
  return (
    <li className="rounded-md border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-h4 font-semibold tabular-nums text-ink">
            {formatOrgTimeRange(visit.scheduledStart, visit.scheduledEnd)}
          </p>
          <p className="mt-1 text-body text-ink">{visit.patientName}</p>
          <p className="text-body-sm text-slate">{visitTypeLabel(visit.visitType)}</p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <Badge tone={STATUS_TONE[status] ?? "neutral"}>
            {VISIT_STATUS_LABELS[status] ?? visit.status}
          </Badge>
          {visit.overdue ? <Badge tone="warning">Not checked in</Badge> : null}
        </div>
      </div>

      {visit.checkedInAt ? (
        <p className="mt-3 text-body-sm text-slate">
          Checked in at {formatOrgTime(visit.checkedInAt)}
          {visit.checkedOutAt ? `, checked out at ${formatOrgTime(visit.checkedOutAt)}` : ""}
        </p>
      ) : null}

      {visit.canCheckIn ? (
        <div className="mt-4">
          <VisitButton visitId={visit.id} action="check_in" label="Check in" />
        </div>
      ) : null}
      {visit.canCheckOut ? (
        <div className="mt-4">
          <VisitButton visitId={visit.id} action="check_out" label="Check out" />
        </div>
      ) : null}
      {canDocument && (visit.canWriteCaregiverUpdate || visit.caregiverUpdate) ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-body-sm font-semibold text-ink">
            Visit update{visit.caregiverUpdate?.status ? ` - ${visit.caregiverUpdate.status}` : ""}
          </p>
          <CaregiverVisitUpdateForm
            visitId={visit.id}
            initialContent={visit.caregiverUpdate?.content ?? ""}
            status={visit.caregiverUpdate?.status ?? null}
          />
        </div>
      ) : null}
    </li>
  );
}

function TaskCard({ task }: { task: TaskRow }) {
  return (
    <li className="rounded-md border border-border bg-white p-4">
      <p className="text-body font-medium text-ink">{task.title}</p>
      {task.details ? <p className="mt-1 text-body-sm text-slate">{task.details}</p> : null}
      <p className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-slate">
        {task.patientName ? <span>{task.patientName}</span> : null}
        {task.dueDate ? <span className="tabular-nums">Due {formatCalendarDate(task.dueDate)}</span> : null}
        {task.overdue ? <Badge tone="warning">Overdue</Badge> : null}
      </p>
      {task.canComplete ? (
        <div className="mt-4">
          <TaskDoneButton taskId={task.id} />
        </div>
      ) : null}
    </li>
  );
}

export default async function CaregiverPage() {
  // Every page asks who is asking by itself; the shell is not the lock.
  const user = await requireUser();
  const permissions = await getRequestPermissions(user.id);
  const now = new Date();

  let day: CaregiverDay;
  try {
    day = await getCaregiverDay(user.id, now);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="My day" />;
    throw err;
  }

  // The checklist is the ordinary task list, so its rules are the ordinary
  // task rules. Only what is given to THIS person and still open is shown.
  const tasks = permissions.has("tasks.read")
    ? (await listTasks(user.id)).open.filter((t) => t.assigneeId === user.id)
    : [];

  return (
    <>
      <PageHeader
        title="My day"
        description={`${formatOrgDate(now)}. Check in when you arrive and check out when you leave. Times are office time (Central).`}
      />

      {day.carriedOver.length > 0 ? (
        <Section
          title="Still checked in"
          description="These visits were never checked out. Check out to close them."
        >
          <ul className="flex flex-col gap-3">
            {day.carriedOver.map((v) => (
              <VisitCard key={v.id} visit={v} canDocument={permissions.has("visits.caregiver_document")} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Visits today">
        {day.today.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No visits today">
            Nothing is scheduled for you today. If that looks wrong, ask the office.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {day.today.map((v) => (
              <VisitCard key={v.id} visit={v} canDocument={permissions.has("visits.caregiver_document")} />
            ))}
          </ul>
        )}
      </Section>

      {permissions.has("tasks.read") ? (
        <Section title="My checklist" description="Tasks given to you that are not finished yet.">
          {tasks.length === 0 ? (
            <EmptyState icon={ListChecks} title="Nothing on your checklist">
              Every task given to you is finished.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </>
  );
}
