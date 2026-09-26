import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { requireUser, roleKeysOf } from "@/lib/app/access";
import { getMfaStatus } from "@/lib/auth/mfa";
import { MfaEnrollment } from "./mfa-enrollment";

export const metadata = { title: "Sign-in security" };

const NON_STAFF_ROLES = new Set(["PATIENT", "AUTHORIZED_FAMILY", "REFERRAL_PARTNER"]);

export default async function MfaPage() {
  const user = await requireUser();
  if (!roleKeysOf(user).some((key) => !NON_STAFF_ROLES.has(key))) redirect("/dashboard");
  const status = await getMfaStatus(user.id);

  return (
    <>
      <PageHeader
        title="Sign-in security"
        description="Add an authenticator app to protect this staff account. This never changes access to patient information."
      />
      <Section title="Authenticator app" description="Use Google Authenticator, Microsoft Authenticator, Authy, 1Password, or another app that supports time-based one-time codes.">
        <MfaEnrollment status={status} />
      </Section>
    </>
  );
}
