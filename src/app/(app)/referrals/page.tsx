import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  canRecordReferrals,
  listReferrals,
  type ReferralLists,
  type ReferralRow,
} from "@/lib/referrals";
import {
  REFERRAL_STATUS_LABELS,
  referralSourceLabel,
  type ReferralStatus,
} from "@/lib/referral-constants";
import { visitTypeLabel } from "@/lib/visit-constants";
import { formatCalendarDate, formatOrgDate, formatWaiting } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { CreateReferralForm } from "./create-referral-form";
import {
  EditReferralForm,
  ReferralDecisionButtons,
} from "./referral-controls";

// Referral access is permission AND reach AND which fields; every rule
// lives in src/lib/referrals.ts. This screen only draws what that file
// says the person may see and do. Waiting time (below) is computed here
// from createdAt with formatWaiting, not stored anywhere - it is always
// "as of the moment this page rendered". Accept-and-assign is one flow:
// see referral-controls.tsx, which redirects to the new patient's care
// team panel the moment "accept" succeeds.

export const metadata: Metadata = { title: "Referrals" };

const STATUS_TONE: Record<ReferralStatus, NonNullable<BadgeProps["tone"]>> = {
  received: "warning",
  in_review: "info",
  accepted: "success",
  declined: "neutral",
  withdrawn: "neutral",
};

function statusLabel(status: string) {
  return REFERRAL_STATUS_LABELS[status as ReferralStatus] ?? status;
}

function statusTone(status: string) {
  return STATUS_TONE[status as ReferralStatus] ?? "neutral";
}

function ReferralCard({
  referral,
  showWaiting,
}: {
  referral: ReferralRow;
  showWaiting: boolean;
}) {
  const office = referral.office;
  const hasOfficeContent =
    office !== null &&
    (office.sourceContactName ||
      office.sourceContactPhone ||
      office.officeNotes ||
      office.decisionNote);

  return (
    <article className="rounded-md border border-border bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(referral.status)}>
              {statusLabel(referral.status)}
            </Badge>
            {referral.urgency === "urgent" ? (
              <Badge tone="danger">Urgent</Badge>
            ) : null}
            {showWaiting ? (
              <Badge tone="neutral">Waiting {formatWaiting(referral.createdAt)}</Badge>
            ) : null}
            <span className="text-body-sm text-slate">
              {visitTypeLabel(referral.requestedService)}
            </span>
          </div>
          <h3 className="mt-2 font-display text-h3 text-ink">
            {referral.firstName} {referral.lastName}
          </h3>
          <p className="mt-1 text-body-sm text-slate">
            Born {formatCalendarDate(referral.dateOfBirth)}. Sent by{" "}
            {referralSourceLabel(referral.sourceType).toLowerCase()}
            {referral.sourceOrganization
              ? `, ${referral.sourceOrganization}`
              : ""}
            . Recorded {formatOrgDate(referral.createdAt)} by{" "}
            {referral.createdByName}.
          </p>
          {referral.patientName ? (
            <p className="mt-1 text-body-sm text-slate">
              Linked to patient record: {referral.patientName}
              {referral.decidedByName && referral.decidedAt
                ? `. Decided by ${referral.decidedByName} on ${formatOrgDate(referral.decidedAt)}.`
                : "."}
            </p>
          ) : referral.decidedByName && referral.decidedAt ? (
            <p className="mt-1 text-body-sm text-slate">
              Decided by {referral.decidedByName} on{" "}
              {formatOrgDate(referral.decidedAt)}.
            </p>
          ) : null}
        </div>

        <ReferralDecisionButtons
          referralId={referral.id}
          actions={referral.actions}
          matchingPatient={referral.matchingPatient}
        />
      </div>

      <h4 className="mt-6 text-label font-semibold uppercase tracking-[0.15em] text-slate">
        Why care is requested
      </h4>
      <p className="mt-2 whitespace-pre-line text-body text-ink">
        {referral.reason}
      </p>

      {hasOfficeContent && office ? (
        <div className="mt-5 rounded-md border border-border bg-sage/40 px-4 py-3">
          <h4 className="text-label font-semibold uppercase tracking-[0.15em] text-slate">
            Office details
          </h4>
          <dl className="mt-2 space-y-1 text-body-sm text-ink">
            {office.sourceContactName || office.sourceContactPhone ? (
              <div>
                <dt className="inline text-slate">Contact: </dt>
                <dd className="inline">
                  {[office.sourceContactName, office.sourceContactPhone]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
            ) : null}
            {office.officeNotes ? (
              <div>
                <dt className="inline text-slate">Notes: </dt>
                <dd className="inline whitespace-pre-line">
                  {office.officeNotes}
                </dd>
              </div>
            ) : null}
            {office.decisionNote ? (
              <div>
                <dt className="inline text-slate">Reason given: </dt>
                <dd className="inline whitespace-pre-line">
                  {office.decisionNote}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {referral.canEdit && office ? (
        <EditReferralForm
          referralId={referral.id}
          defaults={{
            firstName: referral.firstName,
            lastName: referral.lastName,
            dateOfBirth: referral.dateOfBirth.toISOString().slice(0, 10),
            sourceType: referral.sourceType,
            sourceOrganization: referral.sourceOrganization ?? "",
            sourceContactName: office.sourceContactName ?? "",
            sourceContactPhone: office.sourceContactPhone ?? "",
            requestedService: referral.requestedService,
            urgency: referral.urgency,
            reason: referral.reason,
            officeNotes: office.officeNotes ?? "",
          }}
        />
      ) : null}
    </article>
  );
}

function ReferralList({
  title,
  referrals,
  emptyTitle,
  emptyText,
  showWaiting = false,
}: {
  title: string;
  referrals: ReferralRow[];
  emptyTitle: string;
  emptyText: string;
  showWaiting?: boolean;
}) {
  return (
    <Section title={title}>
      {referrals.length === 0 ? (
        <EmptyState icon={Inbox} title={emptyTitle}>
          {emptyText}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {referrals.map((r) => (
            <ReferralCard key={r.id} referral={r} showWaiting={showWaiting} />
          ))}
        </div>
      )}
    </Section>
  );
}

export default async function ReferralsPage() {
  const user = await requireUser();

  // listReferrals calls requirePermission first. An account without
  // referrals.read gets a plain explanation rather than a crash, and the
  // refusal is already in the audit log by the time this catch runs.
  let lists: ReferralLists;
  try {
    lists = await listReferrals(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Referrals" />;
    throw err;
  }

  const canRecord = await canRecordReferrals(user.id);

  return (
    <>
      <PageHeader
        title="Referrals"
        description="A referral is a request for care, and it usually arrives before the person is a patient. Administrative staff see every referral, including the office details. Anyone else sees only the referral that brought in a patient they are on the care team of, and never the office details."
      />

      {canRecord ? (
        <Section title="Record a referral">
          <div className="rounded-md border border-border bg-white p-4 sm:p-6">
            <CreateReferralForm />
          </div>
        </Section>
      ) : null}

      <ReferralList
        title="Open referrals"
        referrals={lists.open}
        emptyTitle="No open referrals"
        emptyText="Nothing is waiting for an answer in what you can see."
        showWaiting
      />
      <ReferralList
        title="Accepted, declined and withdrawn"
        referrals={lists.closed}
        emptyTitle="Nothing closed yet"
        emptyText="Answered referrals will appear here."
      />
    </>
  );
}
