import { AuthorizationError } from "@/lib/auth/authorize";
import { requireUser } from "@/lib/app/access";
import { listCareRequests } from "@/lib/care-requests";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/app/data-table";
import { CareRequestActions } from "./care-request-actions";
import { formatOrgDate, formatOrgTime } from "@/lib/time";
import { CARE_REQUEST_STATUS_LABELS, type CareRequestStatus } from "@/lib/care-request-constants";
import type { CareRequestRow } from "@/lib/care-requests";
import { MailQuestion } from "lucide-react";

/*
  /care-requests
  ==============
  Everyone who has asked for care through the public site (Round G1),
  newest first. care_requests.manage only (ADMIN, SUPER_ADMIN).

  Every request is saved the moment it is submitted, whether or not
  anyone has looked at it yet - see docs/CARE_REQUESTS.md for the
  honest account of what "notifies the office" means right now (an
  in-app alert on this account's bell, not yet a real e-mail).
*/

const STATUS_TONE: Record<CareRequestStatus, "info" | "success" | "neutral"> = {
  new: "info",
  contacted: "success",
  closed: "neutral",
};

export default async function CareRequestsPage() {
  const user = await requireUser();

  let rows: CareRequestRow[];
  try {
    rows = await listCareRequests(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return <NoAccess area="Care requests" />;
    }
    throw err;
  }

  const columns: Column<CareRequestRow>[] = [
    {
      key: "name",
      header: "Who",
      cell: (r) => (
        <div>
          <p className="font-medium text-ink">{r.fullName}</p>
          <p className="text-caption text-slate">{r.relationship}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cell: (r) => (
        <div className="text-body-sm">
          <p className="text-ink">{r.email}</p>
          <p className="text-slate">
            {r.phone} &middot; prefers {r.preferredContact.toLowerCase()}
          </p>
        </div>
      ),
    },
    {
      key: "interest",
      header: "Interested in",
      cell: (r) => (
        <div className="text-body-sm">
          <p className="text-ink">{r.serviceInterest ?? "Not sure yet"}</p>
          <p className="text-slate">Best time: {r.bestTime}</p>
        </div>
      ),
    },
    {
      key: "when",
      header: "Received",
      cell: (r) => (
        <span className="text-body-sm text-slate">
          {formatOrgDate(r.createdAt)} at {formatOrgTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div>
          <Badge tone={STATUS_TONE[r.status as CareRequestStatus] ?? "neutral"}>
            {CARE_REQUEST_STATUS_LABELS[r.status as CareRequestStatus] ?? r.status}
          </Badge>
          {r.contactedByName ? (
            <p className="mt-1 text-caption text-slate">by {r.contactedByName}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      alignRight: true,
      hideLabelOnCard: true,
      cell: (r) => <CareRequestActions requestId={r.id} status={r.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Care requests"
        description="Everyone who has asked for care through the public site, newest first."
      />
      <Section title="All requests">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          caption="Requests submitted through the public Request care form"
          empty={
            <EmptyState icon={MailQuestion} title="No requests yet.">
              When someone submits the Request care form on the public site,
              it will show up here.
            </EmptyState>
          }
        />
      </Section>
      {rows.some((r) => r.message) ? (
        <Section title="Messages">
          <div className="space-y-3">
            {rows
              .filter((r) => r.message)
              .map((r) => (
                <div key={r.id} className="rounded-md border border-border bg-white p-4">
                  <p className="text-body-sm font-medium text-ink">{r.fullName}</p>
                  <p className="mt-1 text-body-sm text-slate">{r.message}</p>
                </div>
              ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
