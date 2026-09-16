import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-display text-h1 text-ink">Sign in</p>
      <p className="mt-3 text-body text-slate">
        Portal access for staff, patients and families.
      </p>
      <SignInForm />
    </div>
  );
}