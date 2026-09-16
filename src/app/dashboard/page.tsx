import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// This is deliberately bare - it exists to prove sign-in, sessions and
// sign-out work end to end, not to be a real portal. The actual
// patient/family/caregiver/clinical/admin portals are Milestone E.
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const roleNames = user.userRoles
    .map((ur: { role: { name: string } }) => ur.role.name)
    .join(", ");

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
        Signed in
      </p>
      <h1 className="mt-3 font-display text-h1 text-ink">
        Welcome, {user.name}
      </h1>
      <p className="mt-3 text-body text-slate">
        {user.email} &middot; {roleNames || "No role assigned"}
      </p>

      <form action={signOutAction} className="mt-10">
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}