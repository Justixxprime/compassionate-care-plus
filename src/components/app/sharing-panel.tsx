import { Lock } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { formatOrgDate } from "@/lib/time";
import type { SharedWith } from "@/lib/patient-sharing";

/*
  SharingPanel
  ============
  The "Who can see my care" block of the patient's My care screen. Drawing
  only: what may be shown is decided in src/lib/patient-sharing.ts before
  anything reaches here. It changes nothing; to add or stop sharing, the
  patient calls the office.
*/

export function SharingPanel({ people }: { people: SharedWith[] }) {
  return (
    <div>
      <p className="max-w-2xl text-body text-slate">
        The staff looking after you and the office can see your record as part
        of their work. A family member can see only the parts you have chosen
        to share, listed below. To add someone or stop sharing, call the office
        and it takes effect straight away.
      </p>

      <div className="mt-4">
        {people.length === 0 ? (
          <EmptyState icon={Lock} title="You have not shared your care with anyone">
            No family member can see anything about your care right now.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {people.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className="rounded-md border border-border bg-white p-4"
              >
                <p className="text-body font-semibold text-ink">{p.name}</p>
                <p className="text-body-sm text-slate">{p.relationshipLabel}</p>
                <p className="mt-3 text-body-sm text-ink">
                  Can see:{" "}
                  {p.scopeLabels.length > 0 ? p.scopeLabels.join(", ") : "nothing"}
                </p>
                <p className="mt-1 text-body-sm text-slate">
                  {p.sharedUntil
                    ? `Until ${formatOrgDate(p.sharedUntil)}`
                    : "Until you withdraw it"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
