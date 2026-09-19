import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { getUserPermissions, hasPermission } from "@/lib/auth/authorize";
import { getRecentAuditLog } from "@/lib/audit/log";
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
  const canReadVisits = await hasPermission(user.id, "visits.read");
  const canReadCarePlans = await hasPermission(user.id, "care_plans.read");
  const canReadDocuments = await hasPermission(user.id, "documents.read");

  // Only actually queried when the permission check passes - this is
  // the point of RBAC existing at all: a user without audit.read never
  // even causes this query to run, not just "sees a hidden section."
  const recentActivity = canReadAudit ? await getRecentAuditLog(10) : [];

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
        <Link href="/patients" className={buttonVariants({ size: "sm" })}>
          View patients
        </Link>
        {canReadVisits && (
          <Link href="/visits" className={buttonVariants({ size: "sm" })}>
            View visits
          </Link>
        )}
        {canReadCarePlans && (
          <Link href="/care-plans" className={buttonVariants({ size: "sm" })}>
            View care plans
          </Link>
        )}
        {canReadDocuments && (
          <Link href="/documents" className={buttonVariants({ size: "sm" })}>
            View documents
          </Link>
        )}
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

      {/* Only renders for someone who actually holds audit.read - this
          is the same pattern the real security center will use later,
          just proven here first on a bare page. */}
      {canReadAudit && (
        <div className="mt-10 border-t border-border pt-8">
          <p className="text-label font-semibold text-slate">
            Recent activity
          </p>
          <div className="mt-3 space-y-2">
            {recentActivity.length === 0 ? (
              <p className="text-body-sm text-slate">No activity recorded yet.</p>
            ) : (
              recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-body-sm"
                >
                  <span className="text-ink">
                    {entry.action}
                    {entry.actorEmail ? ` (${entry.actorEmail})` : ""}
                  </span>
                  <div className="flex items-center gap-3">
                    <Badge tone={entry.outcome === "allowed" ? "success" : "danger"}>
                      {entry.outcome}
                    </Badge>
                    <span className="text-caption text-slate">
                      {entry.occurredAt.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
