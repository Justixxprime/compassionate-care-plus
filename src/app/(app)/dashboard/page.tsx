import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  UserRoundPlus,
} from "lucide-react";
import {
  getRequestPermissions,
  requireUser,
  roleKeysOf,
} from "@/lib/app/access";
import { getDashboardData } from "@/lib/app/dashboard";
import {
  firstNameOf,
  greetingForHour,
  roleIntro,
} from "@/lib/app/roles";
import { formatOrgTimeRange, formatWaiting, orgHour } from "@/lib/time";
import { visitTypeLabel, VISIT_STATUS_LABELS, type VisitStatus } from "@/lib/visit-constants";
import { referralSourceLabel } from "@/lib/referral-constants";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { StatTile } from "@/components/app/stat-tile";
import { EmptyState } from "@/components/app/empty-state";
import { DataTable } from "@/components/app/data-table";
import type { AttentionTone } from "@/lib/app/dashboard-logic";

export const metadata: Metadata = { title: "Dashboard" };

const ATTENTION_BADGE: Record<AttentionTone, { tone: NonNullable<BadgeProps["tone"]>; label: string }> = {
  danger: { tone: "danger", label: "Urgent" },
  warning: { tone: "warning", label: "Needs attention" },
  info: { tone: "info", label: "To do" },
};

const VISIT_STATUS_TONE: Record<VisitStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  missed: "danger",
};

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-body-sm font-medium text-pine hover:underline"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export default async function DashboardPage() {
  // Every page checks who is asking by itself. The shell around it also
  // did, to draw the menu, but a shell is not a lock (src/lib/app/access.ts).
  const user = await requireUser();
  const permissions = await getRequestPermissions(user.id);
  const now = new Date();
  const data = await getDashboardData(user.id, permissions, now);

  const roleKeys = roleKeysOf(user);
  const hasAnySection =
    data.tiles.length > 0 ||
    data.todaysVisits !== null ||
    data.referrals !== null ||
    data.needsPrimaryNurse !== null ||
    data.plansToApprove !== null;

  return (
    <>
      <PageHeader
        title={`${greetingForHour(orgHour(now))}, ${firstNameOf(user.name)}`}
        description={roleIntro(roleKeys)}
      />

      {!hasAnySection ? (
        <div className="mt-8">
          <EmptyState icon={LayoutDashboard} title="Nothing to show yet">
            This account can sign in, but it does not hold access to any
            screens yet.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* What needs attention, most serious first. */}
          <Section title="Needs attention">
            {data.attention.length === 0 ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-white px-4 py-3">
                <CircleCheck className="h-5 w-5 flex-none text-success" aria-hidden="true" />
                <p className="text-body-sm text-ink">
                  Nothing needs attention right now.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
                {data.attention.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex min-h-11 flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-sage/40 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <Badge tone={ATTENTION_BADGE[item.tone].tone} className="self-start">
                        {ATTENTION_BADGE[item.tone].label}
                      </Badge>
                      <span className="flex-1 text-body-sm text-ink">{item.text}</span>
                      <ArrowRight className="hidden h-4 w-4 flex-none text-slate sm:block" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {data.tiles.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.tiles.map((tile) => (
                <StatTile
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  hint={tile.hint}
                  href={tile.href}
                />
              ))}
            </div>
          ) : null}

          {data.todaysVisits !== null ? (
            <Section
              title="Today's visits"
              description="All times are office time (Central)."
              actions={<ViewAll href="/visits" label="All visits" />}
            >
              <DataTable
                caption="Visits scheduled for today"
                rows={data.todaysVisits}
                rowKey={(v) => v.id}
                empty={
                  <EmptyState icon={CalendarDays} title="No visits today">
                    Nothing is scheduled for today in what you can see.
                  </EmptyState>
                }
                columns={[
                  {
                    key: "time",
                    header: "Time",
                    cell: (v) => (
                      <span className="tabular-nums">
                        {formatOrgTimeRange(v.scheduledStart, v.scheduledEnd)}
                      </span>
                    ),
                  },
                  { key: "patient", header: "Patient", cell: (v) => v.patientName },
                  {
                    key: "visit",
                    header: "Visit",
                    cell: (v) => (
                      <>
                        {visitTypeLabel(v.visitType)}
                        <span className="text-slate"> with {v.clinicianName}</span>
                      </>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (v) => (
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={VISIT_STATUS_TONE[v.status as VisitStatus] ?? "neutral"}>
                          {VISIT_STATUS_LABELS[v.status as VisitStatus] ?? v.status}
                        </Badge>
                        {v.overdue ? <Badge tone="warning">Overdue</Badge> : null}
                      </span>
                    ),
                  },
                ]}
              />
            </Section>
          ) : null}

          {data.referrals !== null || data.needsPrimaryNurse !== null || data.plansToApprove !== null ? (
            <div className="grid gap-x-10 lg:grid-cols-2">
              {data.referrals !== null ? (
                <Section
                  title="Referrals waiting"
                  description={
                    data.referrals.summary.oldestWaitingSince
                      ? `The longest has waited ${formatWaiting(data.referrals.summary.oldestWaitingSince, now)}.`
                      : undefined
                  }
                  actions={<ViewAll href="/referrals" label="All referrals" />}
                >
                  {data.referrals.rows.length === 0 ? (
                    <EmptyState icon={Inbox} title="No referrals waiting">
                      Every referral has been answered.
                    </EmptyState>
                  ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
                      {data.referrals.rows.map((r) => (
                        <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-body-sm font-medium text-ink">
                              {r.firstName} {r.lastName}
                            </p>
                            <p className="text-caption text-slate">
                              {visitTypeLabel(r.requestedService)} from {referralSourceLabel(r.sourceType).toLowerCase()}
                            </p>
                          </div>
                          <div className="flex flex-none flex-col items-end gap-1">
                            {r.urgency === "urgent" ? <Badge tone="danger">Urgent</Badge> : null}
                            <span className="text-caption text-slate">
                              Waiting {formatWaiting(r.createdAt, now)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              ) : null}

              {data.needsPrimaryNurse !== null ? (
                <Section
                  title="Patients without a primary nurse"
                  actions={<ViewAll href="/patients" label="All patients" />}
                >
                  {data.needsPrimaryNurse.length === 0 ? (
                    <EmptyState icon={CircleCheck} title="Every patient has a primary nurse" />
                  ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
                      {data.needsPrimaryNurse.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                          <UserRoundPlus className="h-4 w-4 flex-none text-slate" aria-hidden="true" />
                          <span className="flex-1 text-body-sm font-medium text-ink">{p.name}</span>
                          <span className="text-caption text-slate">
                            {p.hasAnyTeam ? "Team started" : "No team yet"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              ) : null}

              {data.plansToApprove !== null ? (
                <Section
                  title="Care plans to approve"
                  actions={<ViewAll href="/care-plans" label="All care plans" />}
                >
                  {data.plansToApprove.length === 0 ? (
                    <EmptyState icon={ClipboardList} title="No plans waiting for approval" />
                  ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
                      {data.plansToApprove.map((p) => (
                        <li key={p.id} className="px-4 py-3">
                          <p className="text-body-sm font-medium text-ink">{p.title}</p>
                          <p className="text-caption text-slate">
                            {p.patientName}, written by {p.authorName}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {data.recentActivity !== null ? (
        <Section
          title="Recent activity"
          description="What happened, never what was said."
        >
          {data.recentActivity.length === 0 ? (
            <EmptyState title="No activity recorded yet" />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
              {data.recentActivity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 truncate text-body-sm text-ink">
                    {entry.action.replace(/_/g, " ")}
                    {entry.actorEmail ? (
                      <span className="text-slate"> by {entry.actorEmail}</span>
                    ) : null}
                  </span>
                  <span className="flex flex-none items-center gap-3">
                    <Badge tone={entry.outcome === "allowed" ? "success" : "danger"}>
                      {entry.outcome}
                    </Badge>
                    <span className="text-caption tabular-nums text-slate">
                      {entry.occurredAt.toLocaleString("en-US", { timeZone: "America/Chicago" })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      <details className="mt-8 rounded-md border border-border bg-white px-4 py-3">
        <summary className="cursor-pointer text-body-sm font-medium text-ink">
          What this account can do ({permissions.size})
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.size === 0 ? (
            <p className="text-body-sm text-slate">This account holds no permissions.</p>
          ) : (
            Array.from(permissions)
              .sort()
              .map((key) => (
                <Badge key={key} tone="neutral">
                  {key}
                </Badge>
              ))
          )}
        </div>
      </details>
    </>
  );
}
