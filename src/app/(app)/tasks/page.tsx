import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getTaskCreateOptions, listTasks, type TaskLists, type TaskRow } from "@/lib/tasks";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/task-constants";
import { formatCalendarDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { DataTable, type Column } from "@/components/app/data-table";
import { NoAccess } from "@/components/app/no-access";
import { TaskForm } from "./task-form";
import { TaskActions } from "./task-actions";

export const metadata: Metadata = { title: "Tasks" };

const columns: Column<TaskRow>[] = [
  {
    key: "task",
    header: "Task",
    cell: (t) => (
      <>
        <span className="font-medium">{t.title}</span>
        {t.details ? <span className="block text-slate">{t.details}</span> : null}
      </>
    ),
  },
  {
    key: "patient",
    header: "Patient",
    cell: (t) =>
      t.patientId && t.patientName ? (
        <Link href={`/patients/${t.patientId}`} className="text-pine hover:underline">
          {t.patientName}
        </Link>
      ) : (
        <span className="text-slate">None</span>
      ),
  },
  {
    key: "who",
    header: "Responsible",
    cell: (t) => (
      <>
        {t.assigneeName}
        <span className="block text-slate">asked by {t.createdByName}</span>
      </>
    ),
  },
  {
    key: "due",
    header: "Due",
    cell: (t) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="tabular-nums">{t.dueDate ? formatCalendarDate(t.dueDate) : "No date"}</span>
        {t.overdue ? <Badge tone="warning">Overdue</Badge> : null}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (t) => (
      <Badge tone={t.status === "done" ? "success" : t.status === "cancelled" ? "neutral" : "info"}>
        {TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status}
      </Badge>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    alignRight: true,
    hideLabelOnCard: true,
    cell: (t) =>
      t.canComplete || t.canCancel ? (
        <TaskActions taskId={t.id} canComplete={t.canComplete} canCancel={t.canCancel} />
      ) : null,
  },
];

export default async function TasksPage() {
  const user = await requireUser();

  let lists: TaskLists;
  try {
    lists = await listTasks(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Tasks" />;
    throw err;
  }

  const options = lists.canManage ? await getTaskCreateOptions(user.id) : null;

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Small pieces of work somebody owes. Administrative roles see every task. Everyone else sees the tasks given to them or created by them, and a task about a patient disappears from your list if you come off that patient's care team."
      />

      {options ? (
        <Section title="New task" description="Give a task to yourself, or, in an administrative role, to a colleague.">
          <TaskForm
            patients={options.patients}
            assignees={options.assignees}
            canAssignToOthers={options.canAssignToOthers}
            selfId={user.id}
          />
        </Section>
      ) : null}

      <Section title="Open tasks">
        <DataTable
          columns={columns}
          rows={lists.open}
          rowKey={(t) => t.id}
          caption="Open tasks"
          empty={
            <EmptyState icon={ListChecks} title="Nothing open">
              Every task you can see is finished.
            </EmptyState>
          }
        />
      </Section>

      {lists.closed.length > 0 ? (
        <Section title="Recently closed">
          <DataTable
            columns={columns}
            rows={lists.closed}
            rowKey={(t) => t.id}
            caption="Recently closed tasks"
            empty={null}
          />
        </Section>
      ) : null}
    </>
  );
}
