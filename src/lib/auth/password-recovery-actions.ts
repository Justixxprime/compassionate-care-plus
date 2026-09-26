"use server";

import { redirect } from "next/navigation";
import {
  requestPasswordRecovery,
  resetPassword,
  type PasswordResetResult,
} from "@/lib/auth/password-recovery";

export interface RecoveryRequestState {
  message?: string;
}

export async function requestPasswordRecoveryAction(
  _previous: RecoveryRequestState,
  formData: FormData,
): Promise<RecoveryRequestState> {
  return requestPasswordRecovery(String(formData.get("email") ?? ""));
}

export async function resetPasswordAction(
  _previous: PasswordResetResult,
  formData: FormData,
): Promise<PasswordResetResult> {
  const result = await resetPassword(
    String(formData.get("token") ?? ""),
    String(formData.get("password") ?? ""),
    String(formData.get("confirmPassword") ?? ""),
  );
  if (result.ok) redirect("/sign-in?passwordReset=1");
  return result;
}
