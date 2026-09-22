import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  getPlanCreateOptions,
  listCarePlans,
  type CarePlanLists,
  type CarePlanRow,
} from "@/lib/care-plans";
import {
  PLAN_STATUS_LABELS,
  type PlanStatus,
} from "@/lib/care-plan-constants";
import { formatOrgDate } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { CreatePlanForm } from "./create-plan-form";
import {
  AddGoalForm,
  EditPlanForm,
  GoalControls,
  PlanStatusButtons,
} from "./plan-controls";

// Care plan access is permission AND relationship AND care team, for
// reading, writing and approving; every rule lives in src/lib/care-plans.ts.
// This screen only draws what that file says the person may see and do.
// The fuller clinical chart arrives with the clinical portal (E3).

export const metadata: Metadata = { title: "Care plans" };

const STATUS_TONE: Record<PlanStatus, NonNullable<BadgeProps["tone"]>> = {
  draft: "warning",
  active: "success",
  completed: "info",
  archived: "neutral",
};

function statusLabel(status: string) {
  return PLAN_STATUS_LABELS[status as PlanStatus] ?? status;
}

function statusTone(status: string) {
  return STATUS_TONE[status as PlanStatus] ?? "neutral";
}

function PlanCard({ plan }: { plan: CarePlanRow }) {
  const isDraft = plan.status === "draft";
  const metCount = plan.goals.filter((g) => g.status === "met").length;

  return (
    <article className="rounded-md border border-border bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(plan.status)}>{statusLabel(plan.status)}</Badge>
            <span className="text-body-sm text-slate">{plan.patientName}</span>
          </div>
          <h3 className="mt-2 font-display text-h3 text-ink">{plan.title}</h3>
          <p className="mt-1 text-body-sm text-slate">
            Written by {plan.authorName}
            {plan.approvedByName && plan.approvedAt
              ? `, approved by ${plan.approvedByName} on ${formatOrgDate(plan.approvedAt)}`
              : ""}
            {plan.completedAt ? `, completed ${formatOrgDate(plan.completedAt)}` : ""}
          </p>
        </div>

        <PlanStatusButtons
          planId={plan.id}
          canApprove={plan.canApprove}
          canComplete={plan.canComplete}
          canDiscard={plan.canDiscard}
        />
      </div>

      <p className="mt-4 whitespace-pre-line text-body text-ink">{plan.summary}</p>

      {plan.canEditContent ? (
        <EditPlanForm
          planId={plan.id}
          title={plan.title}
          summary={plan.summary}
        />
      ) : null}

      <h4 className="mt-6 text-label font-semibold uppercase tracking-[0.15em] text-slate">
        Goals{plan.goals.length > 0 ? ` (${metCount} of ${plan.goals.length} met)` : ""}
      </h4>
      {plan.goals.length === 0 ? (
        <p className="mt-2 text-body-sm text-slate">
          {isDraft
            ? "No goals yet. A plan needs at least one before it can be approved."
            : "This plan has no goals."}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {plan.goals.map((goal) => (
            <li
              key={goal.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="text-body text-ink">{goal.description}</p>
                {goal.status === "met" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone="success">Met</Badge>
                    {goal.metAt ? (
                      <span className="text-caption text-slate">
                        {formatOrgDate(goal.metAt)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <GoalControls
                goalId={goal.id}
                canMarkMet={plan.canMarkGoals && goal.status === "open"}
                canRemove={plan.canEditContent}
              />
            </li>
          ))}
        </ul>
      )}

      {plan.canEditContent ? <AddGoalForm planId={plan.id} /> : null}
    </article>
  );
}

function PlanList({
  title,
  plans,
  emptyTitle,
  emptyText,
}: {
  title: string;
  plans: CarePlanRow[];
  emptyTitle: string;
  emptyText: string;
}) {
  return (
    <Section title={title}>
      {plans.length === 0 ? (
        <EmptyState icon={ClipboardList} title={emptyTitle}>
          {emptyText}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </Section>
  );
}

export default async function CarePlansPage() {
  const user = await requireUser();

  // listCarePlans calls requirePermission first. An account without
  // care_plans.read gets a plain explanation rather than a crash, and the
  // refusal is already in the audit log by the time this catch runs.
  let lists: CarePlanLists;
  try {
    lists = await listCarePlans(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Care plans" />;
    throw err;
  }

  const options = await getPlanCreateOptions(user.id);

  return (
    <>
      <PageHeader
        title="Care plans"
        description="Everyone here can read the plans of the patients they can reach. Only the people on a patient's care team can write or edit one, and a plan is approved by someone other than its author. Once approved, its wording is locked."
      />

      {options !== null ? (
        <Section
          title="Start a care plan"
          description="One draft at a time, for an active patient you are on the care team of."
        >
          {options.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No patient to start a plan for">
              You can write a plan for an active patient you are on the care
              team of, when they have no draft already.
            </EmptyState>
          ) : (
            <div className="rounded-md border border-border bg-white p-4 sm:p-6">
              <CreatePlanForm options={options} />
            </div>
          )}
        </Section>
      ) : null}

      <PlanList
        title="Drafts and active plans"
        plans={lists.current}
        emptyTitle="No draft or active plans"
        emptyText="Nothing is waiting or in use for this account."
      />
      <PlanList
        title="Completed and discarded"
        plans={lists.past}
        emptyTitle="Nothing finished yet"
        emptyText="Completed and discarded plans will appear here."
      />
    </>
  );
}
