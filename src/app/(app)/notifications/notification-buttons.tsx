"use client";

import { useState, useTransition } from "react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications-actions";
import { Button } from "@/components/ui/button";

// The two buttons on the notifications screen. Both only ever touch the
// signed-in person's own notifications: the server decides who is asking
// from the session, never from anything sent here.

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await markNotificationReadAction(notificationId);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={run}>
        {pending ? "Saving..." : "Mark read"}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MarkAllReadButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="md" variant="secondary" disabled={pending} onClick={run}>
        {pending ? "Saving..." : "Mark all as read"}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
