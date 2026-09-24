import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getShareOptions, listShares, type ShareRow } from "@/lib/document-grants";
import { formatOrgDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { DataTable } from "@/components/app/data-table";
import { NoAccess } from "@/components/app/no-access";
import { ShareForm } from "./share-form";
import { RevokeShareButton } from "./revoke-share-button";

export const metadata: Metadata = { title: "Sharing restricted documents" };

// Who has been let in to restricted documents (insurance cards, ID scans),
// and the way to let someone in or take access back. Every rule lives in
// src/lib/document-grants.ts. This screen only draws what that file says
// the person may do.

export default async function SharingPage() {
  const user = await requireUser();

  // listShares needs documents.grant AND an administrator role. Anyone
  // else gets a plain explanation, and the refusal is already audited.
  let shares: ShareRow[];
  try {
    shares = await listShares(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Sharing restricted documents" />;
    throw err;
  }

  const options = await getShareOptions(user.id);

  return (
    <>
      <Link
        href="/documents"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-body-sm font-medium text-pine hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Documents
      </Link>
      <PageHeader
        title="Sharing restricted documents"
        description="Insurance cards and ID scans are visible to administrators only. Here you can let one other person look at them, for one patient or one document, for as long as you choose, and take it back at any time."
      />

      {options !== null ? (
        <Section title="Share access">
          {options.patients.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No patients yet">
              There is no patient to share documents for.
            </EmptyState>
          ) : (
            <div className="rounded-md border border-border bg-white p-4 sm:p-6">
              <ShareForm options={options} />
            </div>
          )}
        </Section>
      ) : null}

      <Section title="Access in force right now">
        <DataTable
          caption="Restricted document access that has been shared"
          rows={shares}
          rowKey={(s) => s.id}
          empty={
            <EmptyState icon={ShieldCheck} title="Nothing is shared">
              Right now only administrators can open restricted documents.
            </EmptyState>
          }
          columns={[
            {
              key: "who",
              header: "Person",
              cell: (s) => <span className="font-medium">{s.granteeName}</span>,
            },
            { key: "patient", header: "Patient", cell: (s) => s.patientName },
            {
              key: "what",
              header: "What",
              cell: (s) =>
                s.documentId === null ? (
                  <Badge tone="warning">All restricted documents</Badge>
                ) : (
                  <span>{s.documentTitle ?? "One document"}</span>
                ),
            },
            {
              key: "until",
              header: "Until",
              cell: (s) => (
                <>
                  <span className="tabular-nums">
                    {s.expiresAt ? formatOrgDate(s.expiresAt) : "Until taken back"}
                  </span>
                  <span className="block text-caption text-slate">
                    Shared by {s.grantedByName} on {formatOrgDate(s.createdAt)}
                  </span>
                </>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              alignRight: true,
              hideLabelOnCard: true,
              cell: (s) => <RevokeShareButton grantId={s.id} />,
            },
          ]}
        />
      </Section>
    </>
  );
}
