"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { createPartnerReferral } from "@/lib/partner-referrals";
import type { ReferralDetailsInput } from "@/lib/referrals";
const text = (data: FormData, key: string) => String(data.get(key) ?? "");
export async function createPartnerReferralAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  const input: ReferralDetailsInput = { firstName: text(formData, "firstName"), lastName: text(formData, "lastName"), dateOfBirth: text(formData, "dateOfBirth"), sourceType: text(formData, "sourceType"), sourceOrganization: text(formData, "sourceOrganization"), sourceContactName: text(formData, "sourceContactName"), sourceContactPhone: text(formData, "sourceContactPhone"), requestedService: text(formData, "requestedService"), urgency: text(formData, "urgency"), reason: text(formData, "reason"), officeNotes: "" };
  try { const result = await createPartnerReferral(user.id, input); if (result.ok) revalidatePath("/partner-referrals"); return result.ok ? { ok: true } : result; } catch (error) { if (error instanceof AuthorizationError) return { ok: false, error: "You do not have permission to do that." }; throw error; }
}
