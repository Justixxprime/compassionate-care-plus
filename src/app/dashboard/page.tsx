// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { getUserPermissions, hasPermission } from "@/lib/auth/authorize";
import { getRecentAuditLog } from "@/lib/audit/log";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const roleNames = user.userRoles
    .map((ur: { role: { name: string } }) => ur.role.name)
    .join(", ");

  const permissions = await getUserPermissions(user.id);
  const canManageStaff = await hasPermission(user.id, "staff.manage");
  const canReadAudit = await hasPermission(user.id, "audit.read");
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
        <button type="submit" className={cn(buttonVariants({ variant: "secondary" }))}>
          Sign out
        </button>
      </form>
    </div>
  );
}