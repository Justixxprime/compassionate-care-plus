"use client";

import { useState, useTransition, type FormEvent } from "react";
import { scheduleVisitAction } from "@/lib/visits-actions";
import {
  VISIT_DURATIONS_MINUTES,
  VISIT_TYPES,
} from "@/lib/visit-constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// One patient the form can schedule for, and the clinicians it may assign
// to them. Built on the server (getSchedulingOptions) from what THIS
// signed-in person is allowed to reach - the browser never gets a list of
// patients or staff it has no business seeing.
export interface SchedulingOptionProp {
  patientId: string;
  patientName: string;
  clinicians: { id: string; name: string; roleOnCase: string }[];
}

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";

function roleLabel(roleOnCase: string) {
  return roleOnCase.replace(/_/g, " ");
}

export function ScheduleVisitForm({
  options,
}: {
  options: SchedulingOptionProp[];
}) {
  const [patientId, setPatientId] = useState(options[0]?.patientId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = options.find((o) => o.patientId === patientId);

  // Deliberately handled in onSubmit rather than as a form action: React
  // clears a form after an action finishes, even when it failed, which
  // would wipe everything the person typed just because one field was
  // wrong. Handling it here keeps their input until it actually succeeds.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await scheduleVisitAction(data);
      if (result.ok) {
        setMessage("Visit scheduled.");
        form.reset();
        setPatientId(options[0]?.patientId ?? "");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="patientId">Patient</Label>
          <select
            id="patientId"
            name="patientId"
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className={selectStyles}
          >
            {options.map((o) => (
              <option key={o.patientId} value={o.patientId}>
                {o.patientName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="clinicianId">Clinician</Label>
          {/* key forces a fresh list whenever the patient changes, so a
              clinician from the previous patient is never left selected. */}
          <select
            key={patientId}
            id="clinicianId"
            name="clinicianId"
            required
            className={selectStyles}
          >
            {(selected?.clinicians ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({roleLabel(c.roleOnCase)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <Label htmlFor="visitType">Visit type</Label>
          <select
            id="visitType"
            name="visitType"
            required
            defaultValue={VISIT_TYPES[0].key}
            className={selectStyles}
          >
            {VISIT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="startLocal">Start (office time, Central)</Label>
          <input
            id="startLocal"
            name="startLocal"
            type="datetime-local"
            required
            className={selectStyles}
          />
        </div>

        <div>
          <Label htmlFor="durationMinutes">Length</Label>
          <select
            id="durationMinutes"
            name="durationMinutes"
            required
            defaultValue={60}
            className={selectStyles}
          >
            {VISIT_DURATIONS_MINUTES.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="rounded-md bg-success-bg px-3 py-2 text-body-sm text-success"
        >
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Scheduling..." : "Schedule visit"}
      </Button>
    </form>
  );
}
