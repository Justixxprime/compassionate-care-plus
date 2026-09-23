import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { listVisits, type VisitRow } from "@/lib/visits";
import { getVisitNote } from "@/lib/visit-notes";
import {
  VISIT_STATUS_LABELS,
  actionsAvailableFor,
  visitTypeLabel,
  type VisitStatus,
} from "@/lib/visit-constants";
import { formatOrgDate, formatOrgTimeRange } from "@/lib/time";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { NoAccess } from "@/components/app/no-access";
import { VisitActions } from "../visit-actions";
import { VisitNotePanel } from "./visit-note-panel";

export const metadata: Metadata = { title: "Visit" };

// One visit, from the same already-checked read the /visits list uses -
// this page does not ask a new access question of its own, it just
// filters listVisits down to one id. A visit that does not exist and one
// this account cannot reach look identical from here, same as
// everywhere else in this app.

const STATUS_TONE: Record<VisitStatus, NonNullable<BadgeProps["tone"]>> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  missed: "danger",
};

async function loadOptional<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AuthorizationError) return null;
    throw err;
  }
}

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: visitId } = await params;
  const user = await requireUser();

  const lists = await loadOptional(() => listVisits(user.id));
  if (!lists) return <NoAccess area="This visit" />;

  const visit: VisitRow | undefined = [...lists.upcoming, ...lists.recent].find(
    (v) => v.id === visitId,
  );
  if (!visit) return <NoAccess area="This visit" />;

  const noteResult = await loadOptional(() => getVisitNote(user.id, visitId));
  const noteData = noteResult && noteResult.ok ? noteResult.value : null;

  return (
    <>
      <Link
        href="/visits"
        className="inline-flex items-center gap-1 text-body-sm text-pine hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to visits
      </Link>

      <PageHeader
        title={`${visitTypeLabel(visit.visitType)} - ${visit.patientName}`}
        description={
          <>
            {formatOrgDate(visit.scheduledStart)},{" "}
            {formatOrgTimeRange(visit.scheduledStart, visit.scheduledEnd)} with{" "}
            {visit.clinicianName}. All times are office time (Central).
          </>
        }
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[visit.status as VisitStatus] ?? "neutral"}>
              {VISIT_STATUS_LABELS[visit.status as VisitStatus] ?? visit.status}
            </Badge>
            {visit.overdue ? <Badge tone="warning">Overdue</Badge> : null}
            {visit.canChange && actionsAvailableFor(visit.status).length > 0 ? (
              <VisitActions visitId={visit.id} status={visit.status} />
            ) : null}
          </span>
        }
      />

      <Section
        title="Visit note"
        description="What the assigned clinician found and did. Only the assigned clinician can write it, and only once the visit is in progress or completed. A submitted note is locked and needs a second person to mark it reviewed."
      >
        {noteData ? (
          <VisitNotePanel visitId={visit.id} note={noteData.note} canWrite={noteData.canWrite} />
        ) : (
          <p className="text-body-sm text-slate">
            Your account does not have access to visit documentation.
          </p>
        )}
      </Section>
    </>
  );
}
