// src/lib/documents-actions.ts
"use server";

// Thin wrappers between the browser and src/lib/documents.ts, exactly
// like visits-actions.ts and care-plans-actions.ts: work out WHO is
// asking (from the session cookie, on the server), hand the request to
// the service layer where every real rule lives, and turn the answer
// into something a form can show.
//
// Nothing here decides access. A Server Action is a public HTTP
// endpoint: anyone signed in can call it directly with any values,
// skipping the form entirely, which is why the service layer re-checks
// permission, relationship and category on every call.
//
// Downloading is NOT a server action. A download is a plain GET request
// to /documents/[id]/download (src/app/documents/[id]/download/route.ts),
// which calls getDocumentForDownload and applies the same checks.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { archiveDocument, uploadDocument } from "@/lib/documents";
import { MAX_DOCUMENT_BYTES } from "@/lib/document-constants";

export interface DocumentActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

async function run(
  work: (userId: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<DocumentActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await work(user.id);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/documents");
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

export async function uploadDocumentAction(
  formData: FormData,
): Promise<DocumentActionResult> {
  // A chosen file arrives as a File-like object; anything else (a plain
  // string someone posted by hand, or nothing) is not a file. Checked by
  // shape rather than "instanceof File" so it does not depend on which
  // copy of File the runtime uses.
  const entry = formData.get("file");
  if (
    typeof entry !== "object" ||
    entry === null ||
    typeof entry.arrayBuffer !== "function" ||
    typeof entry.size !== "number" ||
    entry.size === 0
  ) {
    return { ok: false, error: "Choose a file to upload." };
  }
  const file = entry as File;
  // Refuse an oversized file BEFORE reading it into memory.
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `That file is too large. The limit is ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  return run((userId) =>
    uploadDocument(userId, {
      patientId: text(formData, "patientId"),
      category: text(formData, "category"),
      title: text(formData, "title"),
      fileName: file.name,
      bytes,
    }),
  );
}

export async function archiveDocumentAction(
  documentId: string,
): Promise<DocumentActionResult> {
  return run((userId) => archiveDocument(userId, documentId));
}
