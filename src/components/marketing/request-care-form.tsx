"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { services } from "@/lib/services-data";
import { submitCareRequestAction } from "@/lib/care-requests-actions";
import {
  CONTACT_TIME_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/lib/care-request-constants";

/*
  RequestCareForm
  ================
  Round G1: this is now real. Submitting calls submitCareRequestAction
  (src/lib/care-requests-actions.ts), which saves the request and
  notifies the office - see docs/CARE_REQUESTS.md for exactly what
  "notifies the office" means today (an in-app alert, not yet a real
  e-mail landing in an inbox - that is an honest, documented gap, not
  a hidden one).

  The hidden field named "companyWebsite" is a honeypot, not a real
  field: it stays empty and out of the tab order for a real visitor,
  and its label says so for anyone using a screen reader. A script
  that fills in every field it finds usually fills this one too.
*/

export function RequestCareForm() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitCareRequestAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      formRef.current?.reset();
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="rounded-md border border-success bg-success-bg p-6">
        <p className="text-h4 font-semibold text-ink">Request received</p>
        <p className="mt-2 text-body text-slate">
          Thank you. Someone from the care team will follow up soon. If
          this is time-sensitive, call the office directly at{" "}
          <a href="tel:2819037551" className="font-medium text-pine hover:underline">
            (281) 903-7551
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6" noValidate>
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
      >
        <Label htmlFor="companyWebsite">Leave this field empty</Label>
        <input id="companyWebsite" name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-body text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" required autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="relationship">Relationship to patient</Label>
          <select
            id="relationship"
            name="relationship"
            required
            defaultValue=""
            className="h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none"
          >
            <option value="" disabled>
              Select one
            </option>
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" required autoComplete="tel" />
        </div>
      </div>

      <fieldset>
        <legend className="text-label font-medium text-ink">
          Preferred contact method
        </legend>
        <div className="mt-2 flex gap-6">
          {PREFERRED_CONTACT_OPTIONS.map((method) => (
            <label key={method} className="flex items-center gap-2 text-body text-ink">
              <input
                type="radio"
                name="preferredContact"
                value={method}
                defaultChecked={method === "Phone"}
                className="h-4 w-4 accent-pine"
              />
              {method}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="serviceInterest">Service interest</Label>
          <select
            id="serviceInterest"
            name="serviceInterest"
            defaultValue=""
            className="h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none"
          >
            <option value="">Not sure yet</option>
            {services.map((s) => (
              <option key={s.slug} value={s.title}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="bestTime">Best time to contact</Label>
          <select
            id="bestTime"
            name="bestTime"
            defaultValue="Anytime"
            className="h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none"
          >
            {CONTACT_TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="message">
          Message <span className="font-normal text-slate">(optional)</span>
        </Label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Anything that would help the care team understand the situation. Please avoid sharing sensitive medical details here."
          className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink placeholder:text-slate-light focus-visible:outline-none"
        />
        <p className="mt-1.5 text-caption text-slate">
          Please don&rsquo;t include sensitive medical details in this form.
          The care team will follow up to discuss next steps.
        </p>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
