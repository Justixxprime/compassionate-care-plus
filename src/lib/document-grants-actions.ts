// src/lib/document-grants-actions.ts
"use server";

// Thin wrappers between the browser and src/lib/document-grants.ts, exactly
// like documents-actions.ts: work out WHO is asking (from the session
// cookie, on the server), hand the request to the service layer where every
// real rule lives, and turn the answer into something a form can show.
//
// Nothing here decides access. A Server Action is a public HTTP endpoint:
// anyone signed in can call it directly with any values, skipping the form,
// which is why createShare and revokeShare check the permission, the
// administrator role, the patient and the person on every call.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { createShare, revokeShare } from "@/lib/document-grants";

export interface ShareActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

async function run(
  work: (userId: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<ShareActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await work(user.id);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/documents");
    revalidatePath("/documents/sharing");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: NO_PERMISSION };
    }
    throw err;
  }
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

export async function createShareAction(formData: FormData): Promise<ShareActionResult> {
  return run((userId) =>
    createShare(userId, {
      patientId: text(formData, "patientId"),
      documentId: text(formData, "documentId"),
      granteeId: text(formData, "granteeId"),
      duration: text(formData, "duration"),
    }),
  );
}

export async function revokeShareAction(grantId: string): Promise<ShareActionResult> {
  return run((userId) => revokeShare(userId, grantId));
}
