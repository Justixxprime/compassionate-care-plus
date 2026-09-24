"use server";

// Thin wrappers between the browser and src/lib/tasks.ts, exactly like
// visit-notes-actions.ts. They work out WHO is asking (from the session
// cookie, on the server), hand the request to the service layer where
// every real rule lives, and turn the answer into something a form can
// show. Nothing here decides access: a Server Action is a public HTTP
// endpoint, so the service re-checks everything on every call.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { changeTaskStatus, createTask } from "@/lib/tasks";

export interface TaskActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

async function run(
  work: (userId: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<TaskActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  try {
    const result = await work(user.id);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/tasks");
    // The caregiver portal shows the same tasks as a checklist.
    revalidatePath("/caregiver");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: NO_PERMISSION };
    throw err;
  }
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

export async function createTaskAction(formData: FormData): Promise<TaskActionResult> {
  return run((userId) =>
    createTask(userId, {
      title: text(formData, "title"),
      details: text(formData, "details"),
      assigneeId: text(formData, "assigneeId"),
      patientId: text(formData, "patientId"),
      dueDate: text(formData, "dueDate"),
    }),
  );
}

export async function changeTaskStatusAction(
  taskId: string,
  action: string,
): Promise<TaskActionResult> {
  return run((userId) => changeTaskStatus(userId, taskId, action));
}
