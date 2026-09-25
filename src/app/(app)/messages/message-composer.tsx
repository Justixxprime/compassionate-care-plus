"use client";
import { useState, useTransition, type FormEvent } from "react";
import { sendSecureMessageAction } from "@/lib/secure-messages-actions";
import { Button } from "@/components/ui/button";

export function MessageComposer({ patientId }: { patientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setError(null);
    startTransition(async () => { const result = await sendSecureMessageAction(new FormData(form)); if (result.ok) form.reset(); else setError(result.error ?? "Could not send your message."); });
  }
  return <form onSubmit={submit} className="space-y-3"><input type="hidden" name="patientId" value={patientId} /><label htmlFor="message" className="text-body-sm font-medium text-ink">New message</label><textarea id="message" name="body" required maxLength={2000} rows={4} className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink focus-visible:outline-none" placeholder="Write your message for the care team." /><div className="flex items-center gap-3"><Button type="submit" disabled={pending}>{pending ? "Sending..." : "Send securely"}</Button>{error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}</div></form>;
}
