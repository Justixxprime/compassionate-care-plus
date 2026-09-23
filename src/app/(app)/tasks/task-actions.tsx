"use client";

import { useState, useTransition } from "react";
import { changeTaskStatusAction } from "@/lib/tasks-actions";
import { TASK_TRANSITIONS, type TaskAction } from "@/lib/task-constants";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// The buttons on one task row. Which ones appear was decided on the
// server from what this person may do; changeTaskStatus re-checks
// everything on every click.
export function TaskActions({
  taskId,
  canComplete,
  canCancel,
}: {
  taskId: string;
  canComplete: boolean;
  canCancel: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: TaskAction) {
    if (
      action === "cancel" &&
      !window.confirm("Cancel this task? This cannot be undone.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await changeTaskStatusAction(taskId, action);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  const buttons: { action: TaskAction; primary: boolean }[] = [];
  if (canComplete) buttons.push({ action: "complete", primary: true });
  if (canCancel) buttons.push({ action: "cancel", primary: false });
  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {buttons.map(({ action, primary }) => (
          <button
            key={action}
            type="button"
            disabled={pending}
            onClick={() => run(action)}
            className={cn(buttonVariants({ size: "sm", variant: primary ? "primary" : "secondary" }))}
          >
            {TASK_TRANSITIONS[action].label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="max-w-xs text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
