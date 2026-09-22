import { Lock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

/*
  NoAccess
  ========
  What a screen shows when the signed-in account does not hold the
  permission that screen needs. The refusal has already been written to
  the audit log by the time this is drawn. It says so plainly and names
  nothing else: no hint of what the screen would have held.
*/

export function NoAccess({ area }: { area: string }) {
  return (
    <>
      <PageHeader title={area} />
      <div className="mt-6">
        <EmptyState icon={Lock} title="Your account does not have access to this.">
          If you think you should, ask an administrator.
        </EmptyState>
      </div>
    </>
  );
}
