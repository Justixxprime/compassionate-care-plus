"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createShareAction } from "@/lib/document-grants-actions";
import { GRANT_DURATIONS } from "@/lib/document-constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// What the administrator may choose from, built on the server
// (getShareOptions). Only people who can already open documents are
// listed, and the form only offers people who reach the chosen patient.
// createShare checks all of it again on the server.
export interface ShareOptionsProp {
  patients: {
    patientId: string;
    patientName: string;
    documents: { id: string; title: string; categoryLabel: string }[];
  }[];
  people: { id: string; name: string; roleLabel: string; reach: "all" | string[] }[];
}

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";

export function ShareForm({ options }: { options: ShareOptionsProp }) {
  const [patientId, setPatientId] = useState(options.patients[0]?.patientId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patient = options.patients.find((p) => p.patientId === patientId);
  const people = options.people.filter(
    (p) => p.reach === "all" || p.reach.includes(patientId),
  );

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await createShareAction(data);
      if (result.ok) {
        setMessage("Access shared. You can take it back at any time below.");
        form.reset();
        setPatientId(options.patients[0]?.patientId ?? "");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="share-patient">Patient</Label>
          <select
            id="share-patient"
            name="patientId"
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className={selectStyles}
          >
            {options.patients.map((p) => (
              <option key={p.patientId} value={p.patientId}>
                {p.patientName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="share-what">What to share</Label>
          {/* Changing the patient changes this list, so it starts over. */}
          <select id="share-what" name="documentId" key={patientId} className={selectStyles}>
            <option value="">All restricted documents of this patient</option>
            {(patient?.documents ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                Only: {d.title} ({d.categoryLabel})
              </option>
            ))}
          </select>
          <p className="mt-1 text-caption text-slate">
            &ldquo;All&rdquo; also covers restricted documents filed later.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="share-person">Share with</Label>
          <select id="share-person" name="granteeId" key={`p-${patientId}`} required className={selectStyles}>
            {people.length === 0 ? (
              <option value="">Nobody eligible for this patient</option>
            ) : (
              people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.roleLabel})
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-caption text-slate">
            Only people who can already open documents and reach this patient
            are listed.
          </p>
        </div>
        <div>
          <Label htmlFor="share-duration">For how long</Label>
          <select id="share-duration" name="duration" defaultValue="30_days" className={selectStyles}>
            {GRANT_DURATIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-body-sm text-slate">
        This lets them look at and download. It does not let them file,
        archive or share anything. Every download is still written to the
        audit log.
      </p>

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

      <Button type="submit" disabled={pending || people.length === 0}>
        {pending ? "Sharing..." : "Share access"}
      </Button>
    </form>
  );
}
