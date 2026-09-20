import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
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
import { formatCalendarDate, formatOrgDate } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { CreateReferralForm } from "./create-referral-form";
import {
  EditReferralForm,
  ReferralDecisionButtons,
} from "./referral-controls";

// Deliberately plain, like /dashboard, /patients, /visits, /care-plans
// and /documents - this exists to prove referral access works end to end
// (permission AND reach AND which fields), not to be the real intake
// screen. That is Milestone E.

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

function ReferralCard({ referral }: { referral: ReferralRow }) {
  const office = referral.office;
  const hasOfficeContent =
    office !== null &&
    (office.sourceContactName ||
      office.sourceContactPhone ||
      office.officeNotes ||
      office.decisionNote);

  return (
    <article className="rounded-md border border-border bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(referral.status)}>
              {statusLabel(referral.status)}
            </Badge>
            {referral.urgency === "urgent" ? (
              <Badge tone="danger">Urgent</Badge>
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
  emptyText,
}: {
  title: string;
  referrals: ReferralRow[];
  emptyText: string;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-h3 text-ink">{title}</h2>
      {referrals.length === 0 ? (
        <p className="mt-4 border-y border-border py-6 text-body-sm text-slate">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {referrals.map((r) => (
            <ReferralCard key={r.id} referral={r} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function ReferralsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // listReferrals calls requirePermission first. An account without
  // referrals.read gets a plain explanation rather than a crash - the
  // denial itself is already in the audit log by the time this catch runs.
  let lists: ReferralLists;
  try {
    lists = await listReferrals(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-20">
          <h1 className="font-display text-h1 text-ink">Referrals</h1>
          <p className="mt-4 text-body text-slate">
            Your account does not have access to referrals.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-block text-body-sm font-medium text-pine hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      );
    }
    throw err;
  }

  const canRecord = await canRecordReferrals(user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
        Referrals
      </p>
      <h1 className="mt-3 font-display text-h1 text-ink">
        Referrals you can see
      </h1>
      <p className="mt-3 max-w-xl text-body text-slate">
        A referral is a request for care, and it usually arrives before the
        person is a patient. Administrative staff see every referral,
        including the office details. Anyone else sees only the referral that
        brought in a patient they are on the care team of, and never the
        office details. Recording and deciding referrals is administrative
        work.
      </p>

      {canRecord ? (
        <section className="mt-10 rounded-md border border-border bg-white p-6">
          <h2 className="font-display text-h3 text-ink">Record a referral</h2>
          <div className="mt-5">
            <CreateReferralForm />
          </div>
        </section>
      ) : null}

      <ReferralList
        title="Open referrals"
        referrals={lists.open}
        emptyText="No open referrals for this account."
      />
      <ReferralList
        title="Accepted, declined and withdrawn"
        referrals={lists.closed}
        emptyText="Nothing closed yet."
      />

      <div className="mt-12 flex gap-6">
        <Link
          href="/dashboard"
          className="text-body-sm font-medium text-pine hover:underline"
        >
          Back to dashboard
        </Link>
        <Link
          href="/patients"
          className="text-body-sm font-medium text-pine hover:underline"
        >
          Patients
        </Link>
        <Link
          href="/care-plans"
          className="text-body-sm font-medium text-pine hover:underline"
        >
          Care plans
        </Link>
      </div>
    </div>
  );
}
