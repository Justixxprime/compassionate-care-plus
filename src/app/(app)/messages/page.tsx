import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getMyCare } from "@/lib/patient-portal";
import { getSecureMessages, listSecureMessagePatients } from "@/lib/secure-messages";
import { formatOrgDate, formatOrgTime } from "@/lib/time";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { MessageComposer } from "./message-composer";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser();
  try {
    const isPatient = user.userRoles.some((role) => role.role.key === "PATIENT");
    const care = isPatient ? await getMyCare(user.id) : null;

    if (!care) {
      const patients = await listSecureMessagePatients(user.id);
      return <><PageHeader title="Messages" description="Open a conversation only for a patient you currently care for." /><Section title="Patient conversations"><div className="divide-y rounded-md border border-border bg-white">{patients.map((patient) => <Link key={patient.id} href={`/messages/${patient.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-sage"><span><span className="block font-medium text-ink">{patient.name}</span><span className="text-caption text-slate">{patient.lastMessageAt ? `Last message ${formatOrgDate(patient.lastMessageAt)}` : "No messages yet"}</span></span>{patient.unreadCount > 0 ? <span className="rounded-full bg-marigold px-2 py-0.5 text-caption font-semibold text-ink">{patient.unreadCount} new</span> : null}</Link>)}</div></Section></>;
    }

    const thread = await getSecureMessages(user.id, care.patientId);
    if (!thread) return <NoAccess area="Messages" />;
    return <><PageHeader title="Messages" description="A private conversation with your care team. Do not use messages for an emergency. Call 911 for immediate help." /><Section title="Your conversation"><div className="space-y-3">{thread.messages.length > 0 ? thread.messages.map((message) => <article key={message.id} className={message.mine ? "ml-auto max-w-xl rounded-md bg-pine px-4 py-3 text-white" : "max-w-xl rounded-md border border-border bg-white px-4 py-3"}><p className="text-body">{message.body}</p><p className={message.mine ? "mt-2 text-caption text-white/70" : "mt-2 text-caption text-slate"}>{message.mine ? "You" : message.senderName} · {formatOrgDate(message.createdAt)}, {formatOrgTime(message.createdAt)}</p></article>) : <EmptyState icon={MessageCircle} title="No messages yet">Send a message and your care team will see it here.</EmptyState>}</div></Section><Section title="Write to your care team"><MessageComposer patientId={care.patientId} /></Section></>;
  } catch (error) {
    if (error instanceof AuthorizationError) return <NoAccess area="Messages" />;
    throw error;
  }
}
