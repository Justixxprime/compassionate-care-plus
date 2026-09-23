import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getAccessiblePatients, type PatientSummary } from "@/lib/patients";
import { listPatientsNeedingTeam } from "@/lib/care-team";
import { formatCalendarDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { DataTable } from "@/components/app/data-table";
import { NoAccess } from "@/components/app/no-access";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage() {
  // Every page checks who is asking by itself (src/lib/app/access.ts).
  const user = await requireUser();

  // getAccessiblePatients calls requirePermission first. An account
  // without patients.read gets a plain explanation, and the refusal is
  // already in the audit log by the time this catch runs.
  let patients: PatientSummary[];
  try {
    patients = await getAccessiblePatients(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Patients" />;
    throw err;
  }

  // The coordinator's worklist: active patients nobody is the primary
  // nurse for. care_team.read is a different permission from
  // patients.read, so this is null (and simply left out) for an account
  // that does not hold it - the same "no section" pattern the dashboard
  // uses, not a second access check reinvented here.
  let needsTeam: Awaited<ReturnType<typeof listPatientsNeedingTeam>> | null = null;
  try {
    needsTeam = await listPatientsNeedingTeam(user.id);
  } catch (err) {
    if (!(err instanceof AuthorizationError)) throw err;
  }

  return (
    <>
      <PageHeader
        title="Patients"
        description="Administrative roles see every patient in the organization. Everyone else sees only the patients they are assigned to."
      />

      {needsTeam && needsTeam.length > 0 ? (
        <Section
          title="Need a primary nurse"
          description="Every active patient should have exactly one. Open a patient's profile to put someone on their care team."
        >
          <ul className="space-y-2">
            {needsTeam.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="flex items-center justify-between rounded-md border border-border bg-white px-4 py-3 text-body hover:bg-sage/40"
                >
                  <span className="font-medium text-ink">{p.name}</span>
                  <Badge tone={p.hasAnyTeam ? "warning" : "danger"}>
                    {p.hasAnyTeam ? "No primary nurse" : "No one on the team"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="All patients">
        <DataTable
          caption="Patients you can see"
          rows={patients}
          rowKey={(p) => p.id}
          empty={
            <EmptyState icon={Users} title="No patients to show">
              No patients are assigned to this account yet.
            </EmptyState>
          }
          columns={[
            {
              key: "name",
              header: "Name",
              cell: (p) => (
                <Link
                  href={`/patients/${p.id}`}
                  className="font-medium text-pine underline-offset-2 hover:underline"
                >
                  {p.firstName} {p.lastName}
                </Link>
              ),
            },
            {
              key: "dob",
              header: "Date of birth",
              cell: (p) => (
                <span className="tabular-nums">{formatCalendarDate(p.dateOfBirth)}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (p) => (
                <Badge tone={p.status === "active" ? "success" : "neutral"}>
                  {p.status}
                </Badge>
              ),
            },
          ]}
        />
      </Section>
    </>
  );
}
