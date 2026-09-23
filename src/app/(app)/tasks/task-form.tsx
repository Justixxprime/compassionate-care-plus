"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createTaskAction } from "@/lib/tasks-actions";
import { TASK_DETAILS_MAX, TASK_TITLE_MAX } from "@/lib/task-constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// The create form. The lists of people and patients were built on the
// server from what THIS person may use; createTask re-checks every value
// on submit regardless of what this form offered.

const fieldStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";

export function TaskForm({
  patients,
  assignees,
  canAssignToOthers,
  selfId,
}: {
  patients: { id: string; name: string }[];
  assignees: { id: string; name: string }[];
  canAssignToOthers: boolean;
  selfId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Handled in onSubmit, not as a form action, so a mistake in one field
  // does not wipe what the person typed in the others.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createTaskAction(data);
      if (result.ok) {
        setMessage("Task created.");
        form.reset();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="title">Task</Label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={TASK_TITLE_MAX}
          className={fieldStyles}
        />
      </div>

      <div>
        <Label htmlFor="details">Details (optional)</Label>
        <textarea
          id="details"
          name="details"
          rows={3}
          maxLength={TASK_DETAILS_MAX}
          className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink focus-visible:outline-none"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <Label htmlFor="assigneeId">Who is responsible</Label>
          <select
            id="assigneeId"
            name="assigneeId"
            required
            defaultValue={selfId}
            className={fieldStyles}
          >
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id === selfId ? `${a.name} (you)` : a.name}
              </option>
            ))}
          </select>
          {!canAssignToOthers ? (
            <p className="mt-1 text-caption text-slate">You can create tasks for yourself.</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="patientId">About a patient (optional)</Label>
          <select id="patientId" name="patientId" defaultValue="" className={fieldStyles}>
            <option value="">No particular patient</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="dueDate">Due date (optional)</Label>
          <input id="dueDate" name="dueDate" type="date" className={fieldStyles} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Create task"}
        </Button>
        {message ? (
          <p role="status" className="text-body-sm text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
