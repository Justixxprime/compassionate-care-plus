import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { listStaff, type StaffRow } from "@/lib/staff";
import { getAccountOptions } from "@/lib/accounts";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { DataTable, type Column } from "@/components/app/data-table";
import { NoAccess } from "@/components/app/no-access";
import { CreateAccountForm } from "./create-account-form";

export const metadata: Metadata = { title: "Staff" };

const columns: Column<StaffRow>[] = [
  { key: "name", header: "Name", cell: (s) => s.name },
  { key: "email", header: "Email", cell: (s) => s.email },
  {
    key: "roles",
    header: "Roles",
    cell: (s) => (
      <span className="flex flex-wrap gap-1.5">
        {s.roleLabels.length === 0 ? (
          <span className="text-slate">No role assigned</span>
        ) : (
          s.roleLabels.map((r) => (
            <Badge key={r} tone="neutral">
              {r}
            </Badge>
          ))
        )}
      </span>
    ),
  },
  {
    key: "patients",
    header: "Active patients",
    alignRight: true,
    cell: (s) => <span className="tabular-nums">{s.activePatientCount}</span>,
  },
];

export default async function StaffPage() {
  const user = await requireUser();

  let staff: StaffRow[];
  try {
    staff = await listStaff(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Staff" />;
    throw err;
  }

  // null for anyone without staff.manage - the same convenience pattern
  // /consents uses. listStaff above already required staff.manage to get
  // this far, so in practice this is never null here, but the check
  // stays in src/lib/accounts.ts, not on this assumption.
  const accountOptions = await getAccountOptions(user.id);

  return (
    <>
      <PageHeader
        title="Staff"
        description="Everyone with an account in this organization, and how many active patients they are currently on the care team for."
      />

      {accountOptions !== null ? (
        <Section
          title="Create an account"
          description="A staff account, a family account, or a sign-in for a patient who does not have one yet. Family access to a specific patient's care is still recorded separately, on Family access."
        >
          <div className="rounded-md border border-border bg-white p-4 sm:p-6">
            <CreateAccountForm options={accountOptions} />
          </div>
        </Section>
      ) : null}

      <Section title={`${staff.length} ${staff.length === 1 ? "person" : "people"}`}>
        <DataTable
          caption="Staff directory"
          rows={staff}
          rowKey={(s) => s.id}
          columns={columns}
          empty={
            <EmptyState icon={Users} title="No staff accounts yet">
              Create one above.
            </EmptyState>
          }
        />
      </Section>
    </>
  );
}
