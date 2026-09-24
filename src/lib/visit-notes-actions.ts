"use server";

// Thin wrappers between the browser and src/lib/visit-notes.ts, exactly
// like care-plans-actions.ts. They do three things: work out WHO is
// asking (from the session cookie, on the server - never from anything
// the browser sends), hand the request to the service layer where every
// real rule lives, and turn the answer into something a form can show.
//
// Nothing here decides access. A Server Action is a public HTTP
// endpoint: anyone signed in can call these directly with any values,
// skipping the form entirely. That is exactly why the service layer
// re-checks permission, relationship and authorship on every call.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  addVisitNoteAddendum,
  changeVisitNoteStatus,
  createVisitNote,
  reviewVisitNoteAddendum,
  updateVisitNote,
} from "@/lib/visit-notes";

export interface VisitNoteActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

async function run(
  visitId: string,
  work: (userId: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<VisitNoteActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await work(user.id);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/visits/${visitId}`);
    revalidatePath("/visits");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      // requirePermission has already written the permission_denied
      // audit entry by the time it throws.
      return { ok: false, error: NO_PERMISSION };
    }
    throw err;
  }
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

export async function createVisitNoteAction(
  formData: FormData,
): Promise<VisitNoteActionResult> {
  const visitId = text(formData, "visitId");
  return run(visitId, (userId) => createVisitNote(userId, visitId, text(formData, "content")));
}

export async function updateVisitNoteAction(
  formData: FormData,
): Promise<VisitNoteActionResult> {
  const visitId = text(formData, "visitId");
  return run(visitId, (userId) => updateVisitNote(userId, visitId, text(formData, "content")));
}

export async function submitVisitNoteAction(
  visitId: string,
): Promise<VisitNoteActionResult> {
  return run(visitId, (userId) => changeVisitNoteStatus(userId, visitId, "submit"));
}

export async function reviewVisitNoteAction(
  visitId: string,
): Promise<VisitNoteActionResult> {
  return run(visitId, (userId) => changeVisitNoteStatus(userId, visitId, "review"));
}

export async function addAddendumAction(
  formData: FormData,
): Promise<VisitNoteActionResult> {
  const visitId = text(formData, "visitId");
  return run(visitId, (userId) =>
    addVisitNoteAddendum(userId, visitId, text(formData, "kind"), text(formData, "content")),
  );
}

export async function reviewAddendumAction(
  visitId: string,
  addendumId: string,
): Promise<VisitNoteActionResult> {
  return run(visitId, (userId) => reviewVisitNoteAddendum(userId, visitId, addendumId));
}
