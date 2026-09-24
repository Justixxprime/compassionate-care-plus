import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getConsentOptions, listConsents, type ConsentRow } from "@/lib/family-consents";
import { formatOrgDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { DataTable } from "@/components/app/data-table";
import { NoAccess } from "@/components/app/no-access";
import { ConsentForm } from "./consent-form";
import { RevokeConsentButton } from "./revoke-consent-button";

export const metadata: Metadata = { title: "Family access" };

// Who a patient has allowed to see their care, and the way to record a new
// permission or withdraw one. Every rule lives in
// src/lib/family-consents.ts. This screen only draws what that file says
// the person may do.

export default async function ConsentsPage() {
  const user = await requireUser();

  // listConsents needs consents.manage. Anyone else gets a plain
  // explanation, and the refusal is already audited.
  let consents: ConsentRow[];
  try {
    consents = await listConsents(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Family access" />;
    throw err;
  }

  const options = await getConsentOptions(user.id);

  return (
    <>
      <PageHeader
        title="Family access"
        description="A patient decides who in their family may see parts of their care. Record their permission here, and withdraw it at any time. A family member sees only the parts ticked, and nothing else."
      />

      {options !== null ? (
        <Section title="Record a permission">
          {options.patients.length === 0 ? (
            <EmptyState icon={HeartHandshake} title="No patients to record a permission for">
              Only patients who are being looked after now can have family access.
            </EmptyState>
          ) : (
            <div className="rounded-md border border-border bg-white p-4 sm:p-6">
              <ConsentForm options={options} />
            </div>
          )}
        </Section>
      ) : null}

      <Section title="Permissions in force right now">
        <DataTable
          caption="Family members a patient has allowed to see their care"
          rows={consents}
          rowKey={(c) => c.id}
          empty={
            <EmptyState icon={HeartHandshake} title="Nobody has family access">
              Right now no family member can see any patient&apos;s care.
            </EmptyState>
          }
          columns={[
            {
              key: "who",
              header: "Family member",
              cell: (c) => (
                <>
                  <span className="font-medium">{c.familyName}</span>
                  <span className="block text-caption text-slate">{c.relationshipLabel}</span>
                </>
              ),
            },
            { key: "patient", header: "Patient", cell: (c) => c.patientName },
            {
              key: "what",
              header: "Shared",
              cell: (c) => (
                <span className="flex flex-wrap gap-1.5">
                  {c.scopeLabels.map((label) => (
                    <Badge key={label} tone="info">
                      {label}
                    </Badge>
                  ))}
                </span>
              ),
            },
            {
              key: "until",
              header: "Until",
              cell: (c) => (
                <>
                  <span className="tabular-nums">
                    {c.expiresAt ? formatOrgDate(c.expiresAt) : "Until withdrawn"}
                  </span>
                  <span className="block text-caption text-slate">
                    Recorded by {c.recordedByName} on {formatOrgDate(c.createdAt)}
                  </span>
                </>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              alignRight: true,
              hideLabelOnCard: true,
              cell: (c) => <RevokeConsentButton consentId={c.id} />,
            },
          ]}
        />
      </Section>
    </>
  );
}
