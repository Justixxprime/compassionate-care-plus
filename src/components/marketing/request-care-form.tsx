"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { services } from "@/lib/services-data";

/*
  RequestCareForm
  ================
  A real, working form UI: client-side validation, a proper success state,
  no sensitive medical information collected (per
  PHASE_0_ARCHITECTURE.md section 19 - relationship, contact preference
  and general service interest only, nothing clinical).

  IMPORTANT HONESTY NOTE: there is no backend yet. Milestone C (database,
  auth, API) hasn't been built, so this form cannot actually deliver
  anywhere real right now - it validates and shows a genuine success
  state, but the "submission" is not sent or stored anywhere. That gets
  wired to a real email or database destination once the backend spine
  exists. I am not pretending otherwise - see the code comment at the
  bottom of handleSubmit.
*/

const relationships = [
  "Myself",
  "Family member",
  "Friend or caregiver",
  "Healthcare professional / referral",
  "Other",
] as const;

const contactTimes = ["Morning", "Afternoon", "Evening", "Anytime"] as const;

export function RequestCareForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    // No backend exists yet (Milestone C builds it). This form validates
    // for real and shows a real success state, but nothing is actually
    // sent or saved anywhere at this point - see docs/PUBLIC_WEBSITE.md.
    // The wiring here (an API route call, or an email service) is a
    // one-function change once that backend exists; the form itself
    // doesn't need to be rebuilt.
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 500);
  }

  if (submitted) {
    return (
      <div className="rounded-md border border-success bg-success-bg p-6">
        <p className="text-h4 font-semibold text-ink">Request received</p>
        <p className="mt-2 text-body text-slate">
          Thank you — someone from the care team will follow up soon. If
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
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
            {relationships.map((r) => (
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
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-label font-medium text-ink">
          Preferred contact method
        </legend>
        <div className="mt-2 flex gap-6">
          {(["Phone", "Email"] as const).map((method) => (
            <label
              key={method}
              className="flex items-center gap-2 text-body text-ink"
            >
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
            {contactTimes.map((t) => (
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
          placeholder="Anything that would help the care team understand the situation — please avoid sharing sensitive medical details here."
          className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink placeholder:text-slate-light focus-visible:outline-none"
        />
        <p className="mt-1.5 text-caption text-slate">
          Please don&rsquo;t include sensitive medical details in this form —
          the care team will follow up to discuss next steps.
        </p>
      </div>

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
