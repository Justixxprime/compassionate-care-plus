"use client";

import { useState, useTransition, type FormEvent } from "react";
import { assignToCareTeamAction } from "@/lib/care-team-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AssignmentOptions } from "@/lib/care-team";

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";

export function AssignTeamMemberForm({
  options,
}: {
  options: AssignmentOptions;
}) {
  const [staffId, setStaffId] = useState(options.staff[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = options.staff.find((s) => s.id === staffId);
  const availablePlaces = options.places.filter((p) =>
    selected ? selected.canFill.includes(p.key) : false,
  );

  // Handled in onSubmit, not as a form action, for the same reason as
  // the visit scheduling form: a failed submit should not wipe what was
  // already chosen.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("patientId", options.patientId);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await assignToCareTeamAction(data);
      if (result.ok) {
        setMessage("Added to the care team.");
        form.reset();
        setStaffId(options.staff[0]?.id ?? "");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  if (options.staff.length === 0) {
    return (
      <p className="text-body-sm text-slate">
        Nobody is available to add - every eligible person is already on
        this care team.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`staffId-${options.patientId}`}>Person</Label>
          <select
            id={`staffId-${options.patientId}`}
            name="staffId"
            required
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className={selectStyles}
          >
            {options.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor={`roleOnCase-${options.patientId}`}>Place on the team</Label>
          {/* key forces a fresh list whenever the person changes, so a
              place that person cannot fill is never left selected. */}
          <select
            key={staffId}
            id={`roleOnCase-${options.patientId}`}
            name="roleOnCase"
            required
            className={selectStyles}
          >
            {availablePlaces.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-body-sm text-success">
          {message}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending || availablePlaces.length === 0}>
        {pending ? "Adding..." : "Add to care team"}
      </Button>
    </form>
  );
}
