import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CalendarDays, ClipboardList, EyeOff, HeartHandshake, Users } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getFamilyCare, type SharedCare } from "@/lib/family-portal";
import { formatOrgDate } from "@/lib/time";
import { PlanCard, TeamGrid, VisitList } from "@/components/app/care-view";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";

export const metadata: Metadata = { title: "Shared with me" };

// What a patient has chosen to share with this family member. Every rule
// (permission, consent, which parts) lives in src/lib/family-portal.ts.
// This screen only draws what that file returned.

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 text-body font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function NotShared({ name, what }: { name: string; what: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed border-border-strong bg-white px-4 py-3">
      <EyeOff className="mt-0.5 h-4 w-4 flex-none text-slate" aria-hidden="true" />
      <p className="text-body-sm text-slate">
        {name} has not shared {what} with you.
      </p>
    </div>
  );
}

function PatientBlock({ care }: { care: SharedCare }) {
  const name = care.patientFirstName;
  const until = care.sharedUntil
    ? `Shared with you until ${formatOrgDate(care.sharedUntil)}.`
    : "Shared with you until it is withdrawn.";
  return (
    <Section title={care.patientName} description={`${care.relationshipLabel}. ${until}`}>
      <Part title="Visits">
        {care.visits === null ? (
          <NotShared name={name} what="the visit schedule" />
        ) : care.visits.upcoming.length === 0 && care.visits.recent.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No visits to show right now">
            When the office schedules a visit, it appears here.
          </EmptyState>
        ) : (
          <>
            {care.visits.upcoming.length > 0 ? (
              <>
                <p className="mb-2 text-body-sm font-medium text-slate">Coming up</p>
                <VisitList visits={care.visits.upcoming} />
              </>
            ) : null}
            {care.visits.recent.length > 0 ? (
              <>
                <p className="mb-2 mt-5 text-body-sm font-medium text-slate">Recent</p>
                <VisitList visits={care.visits.recent} />
              </>
            ) : null}
          </>
        )}
      </Part>

      <Part title="The care team">
        {care.team === null ? (
          <NotShared name={name} what="the care team" />
        ) : care.team.length === 0 ? (
          <EmptyState icon={Users} title="The care team is being put together">
            Names appear here as soon as the office adds them.
          </EmptyState>
        ) : (
          <TeamGrid team={care.team} />
        )}
      </Part>

      <Part title="The care plan">
        {care.plan === null ? (
          <NotShared name={name} what="the care plan" />
        ) : care.plan.plan ? (
          <PlanCard plan={care.plan.plan} />
        ) : (
          <EmptyState icon={ClipboardList} title="The care plan is not ready yet">
            It appears here once the nurse has written it and it has been approved.
          </EmptyState>
        )}
      </Part>
    </Section>
  );
}

export default async function FamilyPage() {
  // Every page asks who is asking by itself; the shell is not the lock.
  const user = await requireUser();

  let shared: SharedCare[];
  try {
    shared = await getFamilyCare(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Shared with me" />;
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Shared with me"
        description="You see the parts of a person's care that they have chosen to share with you. Times are office time (Central). To ask about a visit, or to change what is shared, call the office."
      />

      {shared.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={HeartHandshake} title="Nobody has shared their care with you yet.">
            When a patient gives the office their permission, what they choose to share appears
            here. Please call the office if you expected to see someone.
          </EmptyState>
        </div>
      ) : (
        shared.map((care) => <PatientBlock key={`${care.patientName}-${care.relationshipLabel}`} care={care} />)
      )}
    </>
  );
}
