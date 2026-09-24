// src/lib/notifications.ts
//
// Notifications: a short "something happened for you" entry, one row for
// one person.
//
// THE RULES, in the order they are asked:
//
//   1. OWNERSHIP  A notification belongs to exactly one person, and only
//                 that person can list it or mark it read. Another
//                 person's notification, and one that does not exist,
//                 get the same plain words, and the attempt is audited.
//   2. NO CONTENT A row holds a kind and a record id, never a name, a
//                 title or a clinical word (src/lib/notification-constants.ts
//                 turns the kind into a generic sentence). So there is
//                 nothing here that needs a permission check to read: it
//                 can only ever say "something happened".
//   3. LINKS      The page a notification points at checks permission and
//                 reach again. A notification never opens a door.
//
// Creating one is best effort, exactly like the audit log: a failure to
// write a notification must never be the reason a real task or a real
// review fails for the person doing it. It logs to the server console
// instead. Who gets notified, and when, is decided by the callers
// (tasks.ts, visit-notes.ts); this file only stores and reads.

import "server-only";
import { prisma } from "@/lib/prisma";
import { auditDenied, loadActor } from "@/lib/auth/actor";
import type { Result } from "@/lib/visits";
import {
  NOTIFICATION_LIST_LIMIT,
  describeNotification,
  isNotificationKind,
  type NotificationKind,
} from "@/lib/notification-constants";

const NOT_FOUND = "That notification could not be found.";

export interface NewNotification {
  organizationId: string; // the ACTOR's organization, from their own row
  userId: string; // who it is for
  kind: NotificationKind;
  resourceType: string;
  resourceId: string;
}

export async function notifyUser(n: NewNotification): Promise<void> {
  try {
    if (!isNotificationKind(n.kind)) return;
    // The recipient must be in the same organization as the person who
    // caused the event. A notification never crosses organizations.
    const recipient = await prisma.user.count({
      where: { id: n.userId, organizationId: n.organizationId },
    });
    if (recipient === 0) return;
    await prisma.notification.create({
      data: {
        organizationId: n.organizationId,
        userId: n.userId,
        kind: n.kind,
        resourceType: n.resourceType,
        resourceId: n.resourceId,
      },
    });
  } catch (err) {
    console.error("Failed to write notification:", n.kind, err);
  }
}

// ---------- Reading (your own, only) ----------

export interface NotificationRow {
  id: string;
  text: string;
  href: string;
  createdAt: Date;
  read: boolean;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string): Promise<{
  rows: NotificationRow[];
  unread: number;
}> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_LIST_LIMIT,
    }),
    getUnreadNotificationCount(userId),
  ]);
  return {
    rows: rows.map((r) => {
      const words = describeNotification(r.kind, r.resourceId);
      return {
        id: r.id,
        text: words.text,
        href: words.href,
        createdAt: r.createdAt,
        read: r.readAt !== null,
      };
    }),
    unread,
  };
}

// ---------- Marking read (your own, only) ----------

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<Result<{ id: string }>> {
  const actor = await loadActor(userId);

  const row = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true, readAt: true },
  });
  if (!row || row.userId !== actor.id) {
    await auditDenied(actor, "notification", notificationId);
    return { ok: false, error: NOT_FOUND };
  }
  if (row.readAt === null) {
    // The owner is in the write itself, not only in the check above.
    await prisma.notification.updateMany({
      where: { id: row.id, userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
  }
  return { ok: true, value: { id: row.id } };
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<Result<{ count: number }>> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true, value: { count: result.count } };
}
