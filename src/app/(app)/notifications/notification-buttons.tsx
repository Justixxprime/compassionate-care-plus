"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

// Opening a notification is the normal way to acknowledge it. The server
// action still confirms ownership, then navigation goes to a page that
// independently checks its own permission and relationship rules.
export function NotificationLink({
  notificationId,
  href,
  children,
}: {
  notificationId: string;
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function open() {
    startTransition(async () => {
      const result = await markNotificationReadAction(notificationId);
      if (result.ok) router.push(href);
    });
  }
  return <button type="button" disabled={pending} onClick={open} className="font-medium text-ink hover:underline disabled:opacity-60">{children}</button>;
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
