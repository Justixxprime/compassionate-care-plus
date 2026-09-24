"use server";

// Thin wrappers between the browser and src/lib/notifications.ts, like
// every other *-actions.ts file. They work out WHO is asking from the
// session cookie on the server (never from anything the browser sends),
// hand the request to the service where the rules live, and turn the
// answer into something a button can show.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export interface NotificationActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const result = await markNotificationRead(user.id, notificationId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  await markAllNotificationsRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}
