import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { listNotifications } from "@/lib/notifications";
import { formatOrgDate, formatOrgTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { MarkAllReadButton, MarkReadButton } from "./notification-buttons";

export const metadata: Metadata = { title: "Notifications" };

// Your own notifications, and nobody else's. There is no permission to
// hold: a notification only ever says that something happened, in general
// words, with no patient name and no clinical content. The page each one
// points at checks access again.

export default async function NotificationsPage() {
  const user = await requireUser();
  const { rows, unread } = await listNotifications(user.id);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Short notices that something needs you or has changed. They never contain a patient's name. Open the link to see the details, if you have access."
        actions={unread > 0 ? <MarkAllReadButton /> : undefined}
      />

      <Section title={unread > 0 ? `${unread} unread` : "All caught up"}>
        {rows.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications">
            Nothing has been sent to you yet.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
            {rows.map((n) => (
              <li
                key={n.id}
                className={
                  "flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between " +
                  (n.read ? "" : "bg-sage/50")
                }
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {n.read ? null : <Badge tone="warning">New</Badge>}
                    <Link href={n.href} className="font-medium text-ink hover:underline">
                      {n.text}
                    </Link>
                  </div>
                  <p className="mt-1 text-caption text-slate tabular-nums">
                    {formatOrgDate(n.createdAt)}, {formatOrgTime(n.createdAt)}
                  </p>
                </div>
                {n.read ? null : <MarkReadButton notificationId={n.id} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
