import {
  REFERRAL_CONTACT_NAME_MAX,
  REFERRAL_NAME_MAX,
  REFERRAL_NOTE_MAX,
  REFERRAL_PHONE_MAX,
  REFERRAL_REASON_MAX,
  REFERRAL_SOURCES,
  REFERRAL_SOURCE_ORG_MAX,
  REFERRAL_URGENCIES,
} from "@/lib/referral-constants";
import { VISIT_TYPES } from "@/lib/visit-constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The fields a referral is written with, shared by the "record a
// referral" form and the "edit" form so the two can never drift apart.
// Every input has a real label, and the limits come from the same
// constants the server checks (the server's answer always wins).

export interface ReferralFieldDefaults {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  sourceType: string;
  sourceOrganization: string;
  sourceContactName: string;
  sourceContactPhone: string;
  requestedService: string;
  urgency: string;
  reason: string;
  officeNotes: string;
}

export const EMPTY_REFERRAL_DEFAULTS: ReferralFieldDefaults = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  sourceType: "hospital",
  sourceOrganization: "",
  sourceContactName: "",
  sourceContactPhone: "",
  requestedService: "skilled_nursing",
  urgency: "routine",
  reason: "",
  officeNotes: "",
};

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";
const textareaStyles =
  "w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink focus-visible:outline-none";

export function ReferralFields({
  idPrefix,
  defaults,
}: {
  idPrefix: string;
  defaults: ReferralFieldDefaults;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <Label htmlFor={id("first")}>First name</Label>
          <Input
            id={id("first")}
            name="firstName"
            required
            maxLength={REFERRAL_NAME_MAX}
            defaultValue={defaults.firstName}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor={id("last")}>Last name</Label>
          <Input
            id={id("last")}
            name="lastName"
            required
            maxLength={REFERRAL_NAME_MAX}
            defaultValue={defaults.lastName}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor={id("dob")}>Date of birth</Label>
          <Input
            id={id("dob")}
            name="dateOfBirth"
            type="date"
            required
            defaultValue={defaults.dateOfBirth}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <Label htmlFor={id("service")}>Care requested</Label>
          <select
            id={id("service")}
            name="requestedService"
            required
            defaultValue={defaults.requestedService}
            className={selectStyles}
          >
            {VISIT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={id("urgency")}>How urgent</Label>
          <select
            id={id("urgency")}
            name="urgency"
            required
            defaultValue={defaults.urgency}
            className={selectStyles}
          >
            {REFERRAL_URGENCIES.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={id("source")}>Who sent it</Label>
          <select
            id={id("source")}
            name="sourceType"
            required
            defaultValue={defaults.sourceType}
            className={selectStyles}
          >
            {REFERRAL_SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor={id("reason")}>Why care is being requested</Label>
        <textarea
          id={id("reason")}
          name="reason"
          required
          rows={3}
          maxLength={REFERRAL_REASON_MAX}
          defaultValue={defaults.reason}
          className={textareaStyles}
        />
      </div>

      <fieldset className="rounded-md border border-border bg-sage/40 px-4 pb-4 pt-2">
        <legend className="px-1 text-body-sm font-medium text-pine">
          Office details (only administrative staff can see these)
        </legend>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor={id("org")}>Sending organization</Label>
            <Input
              id={id("org")}
              name="sourceOrganization"
              maxLength={REFERRAL_SOURCE_ORG_MAX}
              defaultValue={defaults.sourceOrganization}
            />
          </div>
          <div>
            <Label htmlFor={id("contact")}>Contact person</Label>
            <Input
              id={id("contact")}
              name="sourceContactName"
              maxLength={REFERRAL_CONTACT_NAME_MAX}
              defaultValue={defaults.sourceContactName}
            />
          </div>
          <div>
            <Label htmlFor={id("phone")}>Contact phone</Label>
            <Input
              id={id("phone")}
              name="sourceContactPhone"
              type="tel"
              maxLength={REFERRAL_PHONE_MAX}
              defaultValue={defaults.sourceContactPhone}
            />
          </div>
        </div>
        <div className="mt-5">
          <Label htmlFor={id("notes")}>Office notes</Label>
          <textarea
            id={id("notes")}
            name="officeNotes"
            rows={2}
            maxLength={REFERRAL_NOTE_MAX}
            defaultValue={defaults.officeNotes}
            className={textareaStyles}
          />
        </div>
      </fieldset>
    </div>
  );
}
