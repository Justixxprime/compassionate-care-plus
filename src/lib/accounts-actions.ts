// src/lib/accounts-actions.ts
"use server";

// Thin wrapper between the browser and src/lib/accounts.ts, exactly like
// family-consents-actions.ts: work out WHO is asking (from the session
// cookie, on the server), hand the request to the service layer where
// every real rule lives, and turn the answer into something a form can
// show.
//
// Nothing here decides access. A Server Action is a public HTTP endpoint:
// anyone signed in can call it directly with any values, skipping the
// form, which is why createAccount checks the permission, the e-mail and
// the patient on every call.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { createAccount } from "@/lib/accounts";

export interface AccountActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

export async function createAccountAction(formData: FormData): Promise<AccountActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await createAccount(user.id, {
      accountType: text(formData, "accountType"),
      name: text(formData, "name"),
      email: text(formData, "email"),
      password: text(formData, "password"),
      confirmPassword: text(formData, "confirmPassword"),
      staffRoleKey: text(formData, "staffRoleKey"),
      patientId: text(formData, "patientId"),
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/staff");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: NO_PERMISSION };
    }
    throw err;
  }
}
