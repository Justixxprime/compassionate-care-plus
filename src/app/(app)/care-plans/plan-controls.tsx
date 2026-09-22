"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  addGoalAction,
  changePlanStatusAction,
  markGoalMetAction,
  removeGoalAction,
  updateCarePlanAction,
} from "@/lib/care-plans-actions";
import {
  GOAL_MAX,
  PLAN_TRANSITIONS,
  SUMMARY_MAX,
  TITLE_MAX,
  type PlanAction,
} from "@/lib/care-plan-constants";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

// The interactive pieces of one care plan card. The page only draws each
// one when the signed-in person is allowed to use it (the flags come from
// listCarePlans), but that is convenience: every action re-checks
// permission, relationship and team membership on the server.

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="max-w-md text-caption text-danger">
      {text}
    </p>
  );
}

// ---------- Approve / complete / discard ----------

const CONFIRM_FIRST: PlanAction[] = ["approve", "complete", "discard"];

const CONFIRM_TEXT: Record<PlanAction, string> = {
  approve:
    "Approve this plan? Its wording will be locked and it becomes the active plan.",
  complete: "Complete this plan? This cannot be undone.",
  discard: "Discard this draft? This cannot be undone.",
};

export function PlanStatusButtons({
  planId,
  canApprove,
  canComplete,
  canDiscard,
}: {
  planId: string;
  canApprove: boolean;
  canComplete: boolean;
  canDiscard: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const actions: PlanAction[] = [
    ...(canApprove ? (["approve"] as const) : []),
    ...(canComplete ? (["complete"] as const) : []),
    ...(canDiscard ? (["discard"] as const) : []),
  ];
  if (actions.length === 0) return null;

  function run(action: PlanAction) {
    if (CONFIRM_FIRST.includes(action) && !window.confirm(CONFIRM_TEXT[action])) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await changePlanStatusAction(planId, action);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={pending}
            onClick={() => run(action)}
            className={cn(
              buttonVariants({
                size: "sm",
                variant: action === "discard" ? "secondary" : "primary",
              }),
            )}
          >
            {PLAN_TRANSITIONS[action].label}
          </button>
        ))}
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

// ---------- Edit the wording of a draft ----------

export function EditPlanForm({
  planId,
  title,
  summary,
}: {
  planId: string;
  title: string;
  summary: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateCarePlanAction(planId, data);
      if (result.ok) setMessage("Saved.");
      else setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <details className="mt-4 rounded-md border border-border bg-sage/40 px-4 py-3">
      <summary className="cursor-pointer text-body-sm font-medium text-pine">
        Edit title and summary
      </summary>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <div>
          <Label htmlFor={`edit-title-${planId}`}>Title</Label>
          <Input
            id={`edit-title-${planId}`}
            name="title"
            defaultValue={title}
            maxLength={TITLE_MAX}
            required
          />
        </div>
        <div>
          <Label htmlFor={`edit-summary-${planId}`}>Summary</Label>
          <textarea
            id={`edit-summary-${planId}`}
            name="summary"
            defaultValue={summary}
            rows={4}
            maxLength={SUMMARY_MAX}
            required
            className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink focus-visible:outline-none"
          />
        </div>
        <ErrorLine text={error} />
        {message ? (
          <p role="status" className="text-caption text-success">
            {message}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </details>
  );
}

// ---------- Add a goal to a draft ----------

export function AddGoalForm({ planId }: { planId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await addGoalAction(planId, data);
      if (result.ok) form.reset();
      else setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4" noValidate>
      <Label htmlFor={`goal-${planId}`}>Add a goal</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`goal-${planId}`}
          name="description"
          maxLength={GOAL_MAX}
          required
        />
        <Button type="submit" size="md" variant="secondary" disabled={pending}>
          {pending ? "Adding..." : "Add goal"}
        </Button>
      </div>
      <div className="mt-2">
        <ErrorLine text={error} />
      </div>
    </form>
  );
}

// ---------- Per goal: mark met, or remove from a draft ----------

export function GoalControls({
  goalId,
  canMarkMet,
  canRemove,
}: {
  goalId: string;
  canMarkMet: boolean;
  canRemove: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canMarkMet && !canRemove) return null;

  function run(work: () => ReturnType<typeof markGoalMetAction>) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {canMarkMet ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => markGoalMetAction(goalId))}
          className={buttonVariants({ size: "sm", variant: "secondary" })}
        >
          Mark met
        </button>
      ) : null}
      {canRemove ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => removeGoalAction(goalId))}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          Remove
        </button>
      ) : null}
      <ErrorLine text={error} />
    </div>
  );
}
