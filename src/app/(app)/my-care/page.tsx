import type { Metadata } from "next";
import { CalendarDays, ClipboardList, Info, Users } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getMyCare, type MyCare } from "@/lib/patient-portal";
import { getWhoCanSeeMyCare, type SharedWith } from "@/lib/patient-sharing";
import { SharingPanel } from "@/components/app/sharing-panel";
import { PlanCard, TeamGrid, VisitList } from "@/components/app/care-view";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";

export const metadata: Metadata = { title: "My care" };

export default async function MyCarePage() {
  // Every page asks who is asking by itself; the shell is not the lock.
  const user = await requireUser();

  let care: MyCare | null;
  let sharedWith: SharedWith[] | null;
  try {
    care = await getMyCare(user.id);
    sharedWith = await getWhoCanSeeMyCare(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="My care" />;
    throw err;
  }

  if (!care) {
    return (
      <>
        <PageHeader title="My care" />
        <div className="mt-6">
          <EmptyState icon={Info} title="Your account is not connected to a care record yet.">
            The office connects your account to your record. Please call the office and
            ask them to do this.
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Hello, ${care.firstName}`}
        description="Your next visits, the people looking after you and your care plan. Times are office time (Central). To change or cancel a visit, call the office."
      />

      <Section title="Your next visits">
        {care.upcoming.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No visits are scheduled right now">
            When the office schedules a visit, it appears here.
          </EmptyState>
        ) : (
          <VisitList visits={care.upcoming} />
        )}
      </Section>

      <Section title="The people looking after you">
        {care.team.length === 0 ? (
          <EmptyState icon={Users} title="Your care team is being put together">
            Names appear here as soon as the office adds them.
          </EmptyState>
        ) : (
          <TeamGrid team={care.team} />
        )}
      </Section>

      <Section title="Your care plan">
        {care.plan ? (
          <PlanCard plan={care.plan} />
        ) : (
          <EmptyState icon={ClipboardList} title="Your care plan is not ready yet">
            Your nurse writes it, and it appears here once it has been approved.
          </EmptyState>
        )}
      </Section>

      {care.recent.length > 0 ? (
        <Section title="Recent visits">
          <VisitList visits={care.recent} />
        </Section>
      ) : null}

      {sharedWith ? (
        <Section title="Who can see my care">
          <SharingPanel people={sharedWith} />
        </Section>
      ) : null}
    </>
  );
}
