import type { Metadata } from "next";
import { History } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  listAuditLog,
  auditActionLabel,
  AUDIT_ACTIONS,
  type AuditLogEntry,
} from "@/lib/audit-log";
import { formatOrgDate, formatOrgTime } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { DataTable, type Column } from "@/components/app/data-table";
import { NoAccess } from "@/components/app/no-access";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Audit log" };

// This screen shows that something happened, who did it, and whether it
// was allowed - never what a record said. See docs/AUDIT_LOGGING.md and
// PHASE_0_ARCHITECTURE.md section 56. The rows are already scoped to
// this account's own organization before they ever reach this file -
// see src/lib/audit-log.ts and src/lib/audit/log.ts.

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";

const columns: Column<AuditLogEntry>[] = [
  {
    key: "when",
    header: "When",
    cell: (e) => (
      <>
        <span className="font-medium tabular-nums">{formatOrgDate(e.occurredAt)}</span>
        <span className="block text-slate tabular-nums">{formatOrgTime(e.occurredAt)}</span>
      </>
    ),
  },
  {
    key: "actor",
    header: "Who",
    cell: (e) => e.actorEmail ?? <span className="text-slate">Unknown</span>,
  },
  {
    key: "action",
    header: "What",
    cell: (e) => (
      <>
        {auditActionLabel(e.action)}
        {e.resourceType ? (
          <span className="block text-slate">
            {e.resourceType}
            {e.resourceId ? ` ${e.resourceId.slice(0, 8)}` : ""}
          </span>
        ) : null}
      </>
    ),
  },
  {
    key: "outcome",
    header: "Outcome",
    cell: (e) => (
      <Badge tone={e.outcome === "allowed" ? "success" : "danger"}>
        {e.outcome === "allowed" ? "Allowed" : "Denied"}
      </Badge>
    ),
  },
];

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; outcome?: string; actor?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const outcome =
    params.outcome === "allowed" || params.outcome === "denied"
      ? params.outcome
      : undefined;
  const action = params.action && params.action !== "" ? params.action : undefined;
  const actor = params.actor && params.actor.trim() !== "" ? params.actor.trim() : undefined;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);

  let result: Awaited<ReturnType<typeof listAuditLog>>;
  try {
    result = await listAuditLog(user.id, { action, outcome, actor }, requestedPage);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Audit log" />;
    throw err;
  }
  const { entries, page, pageCount, total } = result;

  const filtersActive = Boolean(action || outcome || actor);

  // Same query string, different page - so Older/Newer never drop a
  // filter the office already set.
  function pageHref(target: number): string {
    const qs = new URLSearchParams();
    if (action) qs.set("action", action);
    if (outcome) qs.set("outcome", outcome);
    if (actor) qs.set("actor", actor);
    if (target > 1) qs.set("page", String(target));
    const query = qs.toString();
    return query ? `/audit-log?${query}` : "/audit-log";
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sign-in, denial and change of state in this organization, newest first. This never shows what a record said - only that something happened, who did it, and whether it was allowed."
      />

      <Section title="Filter">
        <form
          method="get"
          className="grid gap-4 rounded-md border border-border bg-white p-4 sm:grid-cols-4 sm:items-end sm:p-6"
        >
          <div>
            <Label htmlFor="action">Action</Label>
            <select id="action" name="action" defaultValue={action ?? ""} className={selectStyles}>
              <option value="">Any action</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="outcome">Outcome</Label>
            <select id="outcome" name="outcome" defaultValue={outcome ?? ""} className={selectStyles}>
              <option value="">Any outcome</option>
              <option value="allowed">Allowed</option>
              <option value="denied">Denied</option>
            </select>
          </div>

          <div>
            <Label htmlFor="actor">Who (email contains)</Label>
            <input
              id="actor"
              name="actor"
              type="text"
              defaultValue={actor ?? ""}
              placeholder="e.g. nurse"
              className={selectStyles}
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className={cn(buttonVariants({ size: "md" }))}>
              Apply filters
            </button>
            {filtersActive ? (
              <a href="/audit-log" className={cn(buttonVariants({ size: "md", variant: "secondary" }))}>
                Clear
              </a>
            ) : null}
          </div>
        </form>
      </Section>

      <Section
        title="Entries"
        description={`Showing ${entries.length} of ${total} matching ${total === 1 ? "entry" : "entries"} - page ${page} of ${pageCount}.`}
        actions={
          <div className="flex gap-2">
            <a
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              className={cn(
                buttonVariants({ size: "sm", variant: "secondary" }),
                page <= 1 && "pointer-events-none opacity-40",
              )}
            >
              Newer
            </a>
            <a
              href={pageHref(page + 1)}
              aria-disabled={page >= pageCount}
              className={cn(
                buttonVariants({ size: "sm", variant: "secondary" }),
                page >= pageCount && "pointer-events-none opacity-40",
              )}
            >
              Older
            </a>
          </div>
        }
      >
        <DataTable
          caption="Audit log entries"
          rows={entries}
          rowKey={(e) => e.id}
          columns={columns}
          empty={
            <EmptyState icon={History} title="Nothing matches those filters">
              {filtersActive
                ? "Try clearing a filter."
                : "Nothing has been recorded yet for this organization."}
            </EmptyState>
          }
        />
      </Section>
    </>
  );
}
