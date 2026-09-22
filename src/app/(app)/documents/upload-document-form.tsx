"use client";

import { useState, useTransition, type FormEvent } from "react";
import { uploadDocumentAction } from "@/lib/documents-actions";
import { MAX_DOCUMENT_BYTES, TITLE_MAX } from "@/lib/document-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// What this signed-in person may file, built on the server
// (getDocumentUploadOptions). A nurse is not even offered the restricted
// categories, so the browser is never handed a choice it may not make.
// The server checks again regardless.
export interface UploadOptionsProp {
  patients: { patientId: string; patientName: string }[];
  categories: { key: string; label: string }[];
}

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";

export function UploadDocumentForm({ options }: { options: UploadOptionsProp }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Handled in onSubmit rather than as a form action so a failed attempt
  // keeps what the person typed.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await uploadDocumentAction(data);
      if (result.ok) {
        setMessage("Document filed.");
        form.reset();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="doc-patient">Patient</Label>
          <select id="doc-patient" name="patientId" required className={selectStyles}>
            {options.patients.map((p) => (
              <option key={p.patientId} value={p.patientId}>
                {p.patientName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="doc-category">Kind of document</Label>
          <select id="doc-category" name="category" required className={selectStyles}>
            {options.categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="doc-title">Title</Label>
        <Input id="doc-title" name="title" required maxLength={TITLE_MAX} />
      </div>

      <div>
        <Label htmlFor="doc-file">File</Label>
        <input
          id="doc-file"
          name="file"
          type="file"
          required
          accept="application/pdf,image/png,image/jpeg"
          className="block w-full text-body-sm text-ink file:mr-4 file:rounded-md file:border file:border-border-strong file:bg-white file:px-3 file:py-2 file:text-body-sm file:font-medium"
        />
        <p className="mt-1 text-caption text-slate">
          PDF, PNG or JPEG, up to {Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.
        </p>
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

      <Button type="submit" disabled={pending}>
        {pending ? "Uploading..." : "File document"}
      </Button>
    </form>
  );
}
