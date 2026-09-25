import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import { getMyCare } from "@/lib/patient-portal";
import { getSecureMessages } from "@/lib/secure-messages";
import { formatOrgDate, formatOrgTime } from "@/lib/time";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { MessageComposer } from "./message-composer";
export const metadata: Metadata = { title: "Messages" };
export default async function MessagesPage() { const user = await requireUser(); try { const care = await getMyCare(user.id); if (!care) return <><PageHeader title="Messages" /><EmptyState icon={MessageCircle} title="Your account is not connected to a care record yet">The office connects your account before secure messages are available.</EmptyState></>; const thread = await getSecureMessages(user.id, care.patientId); if (!thread) return <NoAccess area="Messages" />; return <><PageHeader title="Messages" description="A private conversation with your care team. Do not use messages for an emergency. Call 911 for immediate help." /><Section title="Your conversation"><div className="space-y-3">{thread.messages.length ? thread.messages.map(m => <article key={m.id} className={m.mine ? "ml-auto max-w-xl rounded-md bg-pine px-4 py-3 text-white" : "max-w-xl rounded-md border border-border bg-white px-4 py-3"}><p className="text-body">{m.body}</p><p className={m.mine ? "mt-2 text-caption text-white/70" : "mt-2 text-caption text-slate"}>{m.mine ? "You" : m.senderName} · {formatOrgDate(m.createdAt)}, {formatOrgTime(m.createdAt)}</p></article>) : <EmptyState icon={MessageCircle} title="No messages yet">Send a message and your care team will see it here.</EmptyState>}</div></Section><Section title="Write to your care team"><MessageComposer patientId={care.patientId} /></Section></>; } catch (error) { if (error instanceof AuthorizationError) return <NoAccess area="Messages" />; throw error; } }
