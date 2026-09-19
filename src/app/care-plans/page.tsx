import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
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
import { CreatePlanForm } from "./create-plan-form";
import {
  AddGoalForm,
  EditPlanForm,
  GoalControls,
  PlanStatusButtons,
} from "./plan-controls";

// Deliberately plain, like /dashboard, /patients and /visits - this exists
// to prove care plan access works end to end (permission AND relationship
// AND care team, for reading, writing and approving), not to be the real
// clinical chart. That is Milestone E.

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
    <article className="rounded-md border border-border bg-white p-6">
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
  emptyText,
}: {
  title: string;
  plans: CarePlanRow[];
  emptyText: string;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-h3 text-ink">{title}</h2>
      {plans.length === 0 ? (
        <p className="mt-4 border-y border-border py-6 text-body-sm text-slate">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function CarePlansPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // listCarePlans calls requirePermission first. An account without
  // care_plans.read gets a plain explanation rather than a crash - the
  // denial itself is already in the audit log by the time this catch runs.
  let lists: CarePlanLists;
  try {
    lists = await listCarePlans(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-20">
          <h1 className="font-display text-h1 text-ink">Care plans</h1>
          <p className="mt-4 text-body text-slate">
            Your account does not have access to care plans.
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

  const options = await getPlanCreateOptions(user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
        Care plans
      </p>
      <h1 className="mt-3 font-display text-h1 text-ink">
        Care plans you can see
      </h1>
      <p className="mt-3 max-w-xl text-body text-slate">
        Everyone here can read the plans of the patients they can reach.
        Writing a plan is different: only the people on a patient&apos;s care
        team can write or edit one, and a plan is approved by someone other
        than its author. Once approved, its wording is locked.
      </p>

      {options !== null ? (
        <section className="mt-10 rounded-md border border-border bg-white p-6">
          <h2 className="font-display text-h3 text-ink">Start a care plan</h2>
          {options.length === 0 ? (
            <p className="mt-3 text-body-sm text-slate">
              There is no patient you can start a plan for right now. You can
              write a plan for an active patient you are on the care team of,
              one draft at a time.
            </p>
          ) : (
            <div className="mt-5">
              <CreatePlanForm options={options} />
            </div>
          )}
        </section>
      ) : null}

      <PlanList
        title="Drafts and active plans"
        plans={lists.current}
        emptyText="No draft or active care plans for this account."
      />
      <PlanList
        title="Completed and discarded"
        plans={lists.past}
        emptyText="No completed or discarded plans yet."
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
        <Link
          href="/visits"
          className="text-body-sm font-medium text-pine hover:underline"
        >
          Visits
        </Link>
      </div>
    </div>
  );
}
