import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getAccessiblePatients, type PatientSummary } from "@/lib/patients";
import { formatCalendarDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
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

  return (
    <>
      <PageHeader
        title="Patients"
        description="Administrative roles see every patient in the organization. Everyone else sees only the patients they are assigned to."
      />

      <div className="mt-6">
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
                <span className="font-medium">
                  {p.firstName} {p.lastName}
                </span>
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
      </div>
    </>
  );
}
