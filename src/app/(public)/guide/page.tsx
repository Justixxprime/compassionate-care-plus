import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const roles = [
  {
    title: "Owner / Super Admin",
    tone: "Full oversight",
    body: "The highest level of operational access. This role can oversee the organization, manage staff, review activity, manage sensitive document sharing, and use the system's administrative controls.",
    items: ["Organization oversight", "Staff and account management", "Patient and referral oversight", "Sensitive document sharing", "Audit and security review"],
  },
  {
    title: "Administrator",
    tone: "Office operations",
    body: "The main office-management role. Administrators can manage the people, referrals, documents, accounts, care requests, schedules, and operational work that keeps care moving.",
    items: ["Create staff, family and patient accounts", "Manage referrals and care requests", "Manage documents", "Manage care teams and schedules", "Review audit activity"],
  },
  {
    title: "Clinical Supervisor",
    tone: "Clinical oversight",
    body: "A clinical leadership role with access focused on supervision, care plans, visits, patients, care teams, tasks and appropriate clinical review.",
    items: ["Review care plans", "Oversee assigned clinical work", "Review visit documentation", "See relevant patient and team information", "Use clinical oversight tools"],
  },
  {
    title: "Nurse",
    tone: "Patient care",
    body: "A nurse works with patients they are assigned to and uses the system for visits, care plans, referrals, tasks, documents and care communication within their permissions.",
    items: ["View assigned patients", "Schedule and manage visits", "Create and document care plans", "Work with visit notes", "Complete patient-related tasks"],
  },
  {
    title: "Care Coordinator",
    tone: "Coordination",
    body: "A coordination role designed to keep referrals, patients, schedules and care teams organized while respecting patient access boundaries.",
    items: ["Work referrals", "Coordinate patients", "Manage care-team assignments", "Work with visits and schedules", "Coordinate operational tasks"],
  },
  {
    title: "Caregiver",
    tone: "Today's work",
    body: "The caregiver experience is intentionally simple and phone-friendly. A caregiver sees their own day, checks in and out of their own visits, and completes assigned tasks.",
    items: ["See today's own visits", "Check in and check out", "See assigned checklist tasks", "Mark assigned tasks complete", "No access to unrelated patient records"],
  },
  {
    title: "Patient",
    tone: "My care",
    body: "A patient gets a calm, read-only view of their own care. The patient does not see another patient's information.",
    items: ["Upcoming visits", "Current care team", "Active care plan", "Recent completed visits", "Personal documents and secure messages where enabled"],
  },
  {
    title: "Authorized Family",
    tone: "Shared with me",
    body: "Family access is consent-based. Creating a family account does not automatically reveal a patient's information. The patient or authorized office workflow must establish what is shared.",
    items: ["View information explicitly shared", "See shared care information within consent", "See shared documents where permitted", "Access ends when consent ends", "No automatic access to the full chart"],
  },
  {
    title: "Referral Partner",
    tone: "Send and follow",
    body: "A hospital or physician-office referral partner can submit referrals and follow the high-level status of referrals they submitted.",
    items: ["Submit a referral", "See submitted referrals", "Follow high-level status", "No patient chart access", "No office or clinical notes"],
  },
];

const steps = [
  ["01", "A request or referral arrives", "A person can use Request Care on the public website. A hospital or physician-office partner can also submit a referral through the referral-partner portal."],
  ["02", "The office reviews it", "Authorized office staff review the request or referral, confirm the information they need, and decide whether it should move forward."],
  ["03", "A patient record is created", "When an eligible referral is accepted, the system can link it to an existing patient or create a new patient record. This is where the person's care journey becomes an organized record."],
  ["04", "The care team is assigned", "Authorized office staff can assign the appropriate nurse or caregiver. Assignments control what team members can reach."],
  ["05", "Visits are scheduled", "Visits are created with a date, time, visit type and assigned person. The scheduling board gives the office a shared operational view."],
  ["06", "Care is documented", "Care plans, visits, visit notes, documents, tasks and updates are recorded in the appropriate part of the system."],
  ["07", "The patient and family stay connected", "Patients can see their own care. Authorized family members can see information deliberately shared with them through consent."],
  ["08", "The office keeps oversight", "Notifications, care requests, audit activity, account controls and security settings help the organization keep work organized and reviewable."],
];

const sections = [
  ["getting-started", "Getting started"],
  ["staff", "Staff and accounts"],
  ["patients", "Patients"],
  ["referrals", "Referrals"],
  ["care-team", "Care teams"],
  ["visits", "Visits and scheduling"],
  ["care-plans", "Care plans"],
  ["notes", "Visit notes"],
  ["documents", "Documents"],
  ["tasks", "Tasks"],
  ["messages", "Secure messages"],
  ["portals", "Patient, caregiver and family portals"],
  ["requests", "Request Care"],
  ["notifications", "Notifications"],
  ["security", "Security and privacy"],
];

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[4rem_1fr]">
      <div className="font-display text-3xl font-semibold text-marigold">{n}</div>
      <div>
        <h3 className="text-h4 font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-body text-slate">{children}</p>
      </div>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="text-label font-semibold uppercase tracking-[0.18em] text-marigold">{eyebrow}</p>
        <h2 className="mt-3 font-display text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-tight text-ink">{title}</h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-ink px-6 py-20 text-white lg:py-28">
        <div className="relative mx-auto max-w-6xl">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">Cheliv Compassionate Care Plus</p>
          <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.7rem,7vw,5.8rem)] font-semibold leading-[0.96]">
            The complete guide to using Cheliv.
          </h1>
          <p className="mt-6 max-w-2xl text-body-lg leading-relaxed text-white/75">
            A plain-language guide for the owner, administrators, clinical staff, caregivers, patients, families and referral partners. It explains what each part of the system is for, what to do first, and how the pieces connect.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>Sign in</Link>
            <Link href="/request-care" className={buttonVariants({ variant: "secondary", size: "lg" })}>Request care</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-sage/30 px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-label font-semibold uppercase tracking-[0.18em] text-pine">Start here</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">One system, different experiences.</h2>
            <p className="mt-4 text-body text-slate">
              Cheliv is not one giant screen where everyone sees everything. It is a connected care system where each account sees the part of the work that belongs to that person.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Public website", "Information, services, resources, contact and Request Care."],
              ["Office workspace", "Patients, referrals, schedules, documents, staff, tasks and oversight."],
              ["Care team workspace", "Visits, care plans, notes, tasks and patient communication."],
              ["Personal portals", "Patient care, caregiver day, family sharing and referral-partner status."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-md border border-border bg-white p-5">
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-body-sm text-slate">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-marigold">Guide map</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="rounded-full border border-border px-4 py-2 text-body-sm font-medium text-slate transition-colors hover:border-pine hover:text-pine">{label}</a>
            ))}
          </div>
        </div>
      </section>

      <Section id="getting-started" eyebrow="01 / First look" title="How the whole system works">
        <div className="space-y-10">
          {steps.map(([n, title, body]) => <Step key={n} n={n} title={title}>{body}</Step>)}
        </div>
      </Section>

      <Section id="staff" eyebrow="02 / People" title="Staff, family and patient accounts">
        <p className="max-w-3xl text-body-lg text-slate">
          An administrator can open <strong>Staff</strong> and create real accounts. The account flow can create a staff account, an authorized family account, or a sign-in for an existing patient record. Creating a family account does not automatically share a patient's information, and creating a patient account does not create a new patient record.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {roles.map((role) => (
            <article key={role.title} className="rounded-md border border-border bg-sage/20 p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-display text-xl font-semibold text-ink">{role.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-label font-semibold uppercase tracking-wide text-pine">{role.tone}</span>
              </div>
              <p className="mt-3 text-body-sm text-slate">{role.body}</p>
              <ul className="mt-4 space-y-2 text-body-sm text-slate">
                {role.items.map((item) => <li key={item} className="flex gap-2"><span className="text-marigold">•</span><span>{item}</span></li>)}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section id="patients" eyebrow="03 / Patient records" title="Creating and managing patients">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-h4 font-semibold text-ink">The normal path</h3>
            <ol className="mt-4 space-y-4 text-body text-slate">
              <li><strong>1.</strong> A referral is received.</li>
              <li><strong>2.</strong> An authorized office user reviews it.</li>
              <li><strong>3.</strong> The referral is accepted and either linked to an existing matching patient or used to create a new patient.</li>
              <li><strong>4.</strong> The new patient is assigned to the appropriate care team.</li>
              <li><strong>5.</strong> Visits and care planning can then be organized around that patient.</li>
            </ol>
          </div>
          <div className="rounded-md border border-border bg-sage/20 p-6">
            <h3 className="text-h4 font-semibold text-ink">Important</h3>
            <p className="mt-3 text-body text-slate">
              The system deliberately avoids creating duplicate patients when an accepted referral matches an existing person. Patient access also follows the person's current care relationship, not simply the fact that somebody has an account.
            </p>
          </div>
        </div>
        <div className="mt-10">
          <Link href="/sign-in" className={buttonVariants({ variant: "secondary" })}>Open the portal</Link>
        </div>
      </Section>

      <Section id="referrals" eyebrow="04 / Intake" title="Referrals and Request Care">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-md border border-border p-6">
            <h3 className="text-h4 font-semibold text-ink">Public Request Care</h3>
            <p className="mt-3 text-body text-slate">A person can submit a care request without an account. The request is saved, and authorized office administrators receive an in-app notification so it can be followed up from the Care Requests screen.</p>
          </div>
          <div className="rounded-md border border-border p-6">
            <h3 className="text-h4 font-semibold text-ink">Referral workflow</h3>
            <p className="mt-3 text-body text-slate">Office staff can review referrals, start review, accept, decline or withdraw. Accepting can link an existing patient or create a new one when the matching rules are satisfied.</p>
          </div>
        </div>
        <p className="mt-8 text-body text-slate">
          Referral partners have a separate experience: they can submit a referral and see the high-level status of referrals they submitted, without receiving access to patient charts or office notes.
        </p>
      </Section>

      <Section id="care-team" eyebrow="05 / Assignment" title="Care teams control reach">
        <p className="max-w-3xl text-body-lg text-slate">
          A care-team assignment is more than a label. It determines which patient information a clinical worker can reach. When an assignment ends, the worker's access to that patient's relationship-based information stops.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Assign", "An authorized office user selects the patient and the staff member who should be on the care team."],
            ["Work", "The team member sees the patient-related screens their role and permissions allow."],
            ["End", "Ending the assignment removes the relationship without deleting the patient's history."],
          ].map(([title, body]) => <div key={title} className="rounded-md border border-border bg-sage/20 p-5"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-body-sm text-slate">{body}</p></div>)}
        </div>
      </Section>

      <Section id="visits" eyebrow="06 / Scheduling" title="Visits and the scheduling board">
        <p className="max-w-3xl text-body-lg text-slate">
          Visits connect a patient, a staff member, a date and time, and a type of care. Authorized users can create and manage visits within their role. The Scheduling Board provides an operational view, while a visit's own page contains its details and documentation.
        </p>
        <div className="mt-8 space-y-6">
          <Step n="01" title="Create or schedule the visit">Choose the patient, appropriate visit type, assigned person, date and time, then save.</Step>
          <Step n="02" title="Check in">The assigned person checks in when the visit begins. Caregivers use the phone-first My day screen for their own visits.</Step>
          <Step n="03" title="Document">The appropriate clinical user records the visit note. A note can move through the system's review process.</Step>
          <Step n="04" title="Check out">The visit is checked out when care is complete. Final visit states are preserved rather than silently overwritten.</Step>
        </div>
      </Section>

      <Section id="care-plans" eyebrow="07 / Care planning" title="Care plans">
        <p className="max-w-3xl text-body-lg text-slate">
          A care plan turns the patient's needs into a structured set of goals. The clinical workflow uses draft, approval, active and completed states. Once a plan is approved and active, its core wording is locked so the record does not quietly change underneath the approval.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {["Draft", "Approved / active", "Goal progress", "Completed"].map((label, i) => <div key={label} className="rounded-md border border-border p-5"><span className="text-label font-semibold text-marigold">0{i + 1}</span><h3 className="mt-2 font-semibold text-ink">{label}</h3><p className="mt-2 text-body-sm text-slate">{["The plan is being written.", "A second authorized person can approve it.", "Goals can be marked met as care progresses.", "The plan is finished and kept as history."][i]}</p></div>)}
        </div>
      </Section>

      <Section id="notes" eyebrow="08 / Documentation" title="Visit notes and addenda">
        <p className="max-w-3xl text-body-lg text-slate">
          Visit notes belong to the visit and are written by the appropriate clinical user. The review flow separates writing from review. If a correction is needed after a note is finalized, an addendum can be used rather than silently rewriting the original record.
        </p>
      </Section>

      <Section id="documents" eyebrow="09 / Records" title="Documents and controlled sharing">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-h4 font-semibold text-ink">Office Documents</h3>
            <p className="mt-3 text-body text-slate">Authorized staff can file supported patient documents, download them where permitted, and archive them. Restricted categories such as identification and insurance documents have tighter access rules.</p>
          </div>
          <div>
            <h3 className="text-h4 font-semibold text-ink">Sharing</h3>
            <p className="mt-3 text-body text-slate">An administrator can deliberately share restricted documents with one eligible person for a limited period. Sharing does not grant permission to file, archive or re-share the document.</p>
          </div>
        </div>
        <div className="mt-8 rounded-md border border-marigold/30 bg-marigold/5 p-6">
          <h3 className="font-semibold text-ink">Before real patient documents are uploaded</h3>
          <p className="mt-2 text-body text-slate">The application includes a protected document-storage and scanning boundary, but the production scanning service and other production-readiness steps must be completed before using real patient information.</p>
        </div>
      </Section>

      <Section id="tasks" eyebrow="10 / Work management" title="Tasks">
        <p className="max-w-3xl text-body-lg text-slate">
          Tasks are small pieces of work with one responsible person, an optional patient, an optional due date, and a status. Administrative users can coordinate tasks across the organization. Other users see the tasks they are responsible for or created, within their permitted patient reach.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Create", "Give the work to the right person and, when relevant, connect it to a patient."],
            ["Complete", "The responsible person or an authorized administrative user marks it done."],
            ["Cancel", "The creator or an authorized administrative user can cancel work that is no longer needed."],
          ].map(([title, body]) => <div key={title} className="rounded-md border border-border p-5"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-body-sm text-slate">{body}</p></div>)}
        </div>
      </Section>

      <Section id="messages" eyebrow="11 / Communication" title="Secure messages">
        <p className="max-w-3xl text-body-lg text-slate">
          Secure messaging gives a patient and the staff who currently reach that patient one private conversation. Message content is not copied into notifications, audit entries, URLs or email. A caregiver without message permission does not receive a message notification that would lead to a screen they cannot open.
        </p>
      </Section>

      <Section id="portals" eyebrow="12 / Personal portals" title="Patient, caregiver and family experiences">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Patient / My care", "Upcoming visits, current care team, active care plan and recent visits. The patient view is intentionally read only."],
            ["Caregiver / My day", "Today's own visits, check in and check out, and assigned task checklist. It is designed for a phone and does not expose the full patient chart."],
            ["Family / Shared with me", "Consent-based shared information. A family account without an active consent sees no patient's care. Shared documents and care information follow the consent scope."],
          ].map(([title, body]) => <article key={title} className="rounded-md border border-border bg-sage/20 p-6"><h3 className="font-display text-xl font-semibold text-ink">{title}</h3><p className="mt-3 text-body text-slate">{body}</p></article>)}
        </div>
        <p className="mt-8 text-body text-slate">Family access is intentionally separate from secure messaging. Having family access does not automatically mean a family member can read private patient-staff messages.</p>
      </Section>

      <Section id="requests" eyebrow="13 / Public intake" title="Request Care from the public website">
        <p className="max-w-3xl text-body-lg text-slate">
          Someone who needs care does not need an account to start. They can open Request Care, complete the form and submit it. The system saves the request and alerts authorized office administrators inside the app. When configured, an office email alert contains only a notice that a request is waiting, not the person's health information.
        </p>
        <div className="mt-8">
          <Link href="/request-care" className={buttonVariants({ size: "lg" })}>Open Request Care</Link>
        </div>
      </Section>

      <Section id="notifications" eyebrow="14 / Staying informed" title="Notifications">
        <p className="max-w-3xl text-body-lg text-slate">
          The bell tells a user that something needs attention. Notifications are intentionally short and do not expose patient names, clinical details or task content. The link behind a notification checks access again before showing anything.
        </p>
      </Section>

      <Section id="security" eyebrow="15 / Trust and security" title="Security is part of every workflow">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            ["Role-based access", "A person sees only the screens their account is allowed to use."],
            ["Relationship-based access", "For patient information, permission is not enough. The system also checks whether the person currently has the required relationship to the patient."],
            ["Audit trail", "Important actions and security events can be reviewed without copying sensitive clinical content into the audit record."],
            ["Sessions", "Accounts use server-side sessions with expiry and a limit on active sessions."],
            ["Staff MFA", "Staff accounts can use an authenticator app and recovery codes as a second sign-in step."],
            ["Generic refusals", "Where appropriate, the system avoids revealing whether a made-up record exists or whether a real record is simply outside someone's access."],
          ].map(([title, body]) => <div key={title} className="rounded-md border border-border p-6"><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-body-sm text-slate">{body}</p></div>)}
        </div>
        <div className="mt-10 rounded-md border border-border bg-sage/20 p-6">
          <h3 className="font-semibold text-ink">Important production note</h3>
          <p className="mt-2 text-body text-slate">
            This guide describes the software that has been built and tested in the project. It is not a claim that the system is automatically HIPAA compliant or ready for live protected health information. Production launch requires the organization's legal, privacy, security, hosting, backup, incident-response, retention, identity and document-scanning decisions to be completed and verified.
          </p>
        </div>
      </Section>

      <section className="bg-ink px-6 py-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-label font-semibold uppercase tracking-[0.18em] text-marigold">A simple way to remember it</p>
          <h2 className="mt-3 font-display text-[clamp(2rem,5vw,3.6rem)] font-semibold">Request → Review → Patient → Team → Visit → Care → Connect → Review</h2>
          <p className="mx-auto mt-5 max-w-2xl text-body-lg text-white/70">
            Every major feature exists to support that journey while keeping each person's access appropriately limited.
          </p>
        </div>
      </section>
    </div>
  );
}
