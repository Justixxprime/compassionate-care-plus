import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { requireUser } from "@/lib/app/access";
import { listActiveSessions } from "@/lib/auth/session-controls";
import { formatOrgDate } from "@/lib/time";
import { RevokeOtherSessionsForm } from "./revoke-other-sessions-form";

export const metadata = { title: "Active sessions" };

export default async function SessionsPage() {
  const user = await requireUser();
  const sessions = await listActiveSessions(user.id);
  const otherSessionCount = sessions.filter((session) => !session.isCurrent).length;
  return (
    <>
      <PageHeader
        title="Active sessions"
        description="Signed-in sessions for this account. Session identifiers, device details, and location data are not displayed or stored."
      />
      <Section title={`${sessions.length} active ${sessions.length === 1 ? "session" : "sessions"}`}>
        <div className="divide-y rounded-md border border-border bg-white">
          {sessions.map((session) => (
            <article key={`${session.createdAt.toISOString()}-${session.isCurrent}`} className="px-4 py-4">
              <p className="font-medium text-ink">{session.isCurrent ? "This device" : "Another signed-in session"}</p>
              <p className="mt-1 text-caption text-slate">Started {formatOrgDate(session.createdAt)} · Ends {formatOrgDate(session.expiresAt)}</p>
            </article>
          ))}
        </div>
      </Section>
      <Section
        title="Sign out other sessions"
        description="Use this if you lost a device, used a shared computer, or suspect someone else may have access. This device stays signed in."
      >
        <RevokeOtherSessionsForm otherSessionCount={otherSessionCount} />
      </Section>
    </>
  );
}
