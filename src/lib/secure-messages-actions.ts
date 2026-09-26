"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { sendSecureMessage } from "@/lib/secure-messages";

export async function sendSecureMessageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  try {
    const result = await sendSecureMessage(user.id, String(formData.get("patientId") ?? ""), String(formData.get("body") ?? ""));
    if (result.ok) {
      const patientId = String(formData.get("patientId") ?? "");
      revalidatePath("/messages");
      revalidatePath(`/messages/${patientId}`);
    }
    return result.ok ? { ok: true } : result;
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "You do not have permission to do that." };
    throw error;
  }
}
