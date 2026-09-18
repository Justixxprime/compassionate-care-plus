import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccessiblePatients } from "@/lib/patients";
import { Badge } from "@/components/ui/badge";

// Deliberately bare, same as /dashboard - this exists to prove the
// access model works end to end (role permission AND relationship, not
// just one or the other), not to be a real patient list UI. The real
// patient management screens are Milestone E.
export default async function PatientsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // getAccessiblePatients itself calls requirePermission first - if
  // this account didn't hold patients.read, this would throw before
  // ever reaching the database for patient rows. Not caught here on
  // purpose yet; a real error boundary is part of the error-handling
  // phase later, not this one.
  const patients = await getAccessiblePatients(user.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
        Patients
      </p>
      <h1 className="mt-3 font-display text-h1 text-ink">
        Patients you can see
      </h1>
      <p className="mt-3 max-w-md text-body text-slate">
        This list is different depending on who&rsquo;s signed in. An
        administrative role sees every patient in the organization. A
        clinical role like a nurse sees only the patients they&rsquo;re
        actually assigned to.
      </p>

      <div className="mt-8 divide-y divide-border border-y border-border">
        {patients.length === 0 ? (
          <p className="py-6 text-body-sm text-slate">
            No patients assigned to this account.
          </p>
        ) : (
          patients.map((patient) => (
            <div key={patient.id} className="flex items-center justify-between py-4">
              <span className="text-body font-medium text-ink">
                {patient.firstName} {patient.lastName}
              </span>
              <Badge tone={patient.status === "active" ? "success" : "neutral"}>
                {patient.status}
              </Badge>
            </div>
          ))
        )}
      </div>

      <Link
        href="/dashboard"
        className="mt-8 inline-block text-body-sm font-medium text-pine hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
