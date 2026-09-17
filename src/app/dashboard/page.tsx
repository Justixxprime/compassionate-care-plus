import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { getUserPermissions, hasPermission } from "@/lib/auth/authorize";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// This is deliberately bare - it exists to prove sign-in, sessions,
// sign-out, and now RBAC actually work end to end, not to be a real
// portal. The actual patient/family/caregiver/clinical/admin portals
// are Milestone E.
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const roleNames = user.userRoles
    .map((ur: { role: { name: string } }) => ur.role.name)
    .join(", ");

  // Real permission checks, not a hardcoded list - this is exactly what
  // a real page in the admin portal will do later: ask "can THIS person
  // do THIS thing" and only render what the answer allows.
  const permissions = await getUserPermissions(user.id);
  const canManageStaff = await hasPermission(user.id, "staff.manage");
  const canReadAudit = await hasPermission(user.id, "audit.read");

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
        Signed in
      </p>
      <h1 className="mt-3 font-display text-h1 text-ink">
        Welcome, {user.name}
      </h1>
      <p className="mt-3 text-body text-slate">
        {user.email} &middot; {roleNames || "No role assigned"}
      </p>

      {/* Demonstrates hasPermission() actually gating what renders -
          these two links only appear because the checks above passed,
          not because someone forgot to hide them for other roles. */}
      <div className="mt-8 flex flex-wrap gap-3">
        {canManageStaff && (
          <span className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "cursor-default")}>
            Manage staff (permission granted)
          </span>
        )}
        {canReadAudit && (
          <span className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "cursor-default")}>
            View audit log (permission granted)
          </span>
        )}
      </div>

      <div className="mt-10 border-t border-border pt-8">
        <p className="text-label font-semibold text-slate">
          Permissions held by this account ({permissions.length})
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((key) => (
            <Badge key={key} tone="neutral">
              {key}
            </Badge>
          ))}
        </div>
      </div>

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