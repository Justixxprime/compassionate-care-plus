import { notFound } from "next/navigation";
import { requireUser } from "@/lib/app/access";
import { getSecureMessages } from "@/lib/secure-messages";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { MessageComposer } from "../message-composer";
export default async function StaffMessageThreadPage({ params }: PageProps<"/messages/[patientId]">) { const user = await requireUser(); const { patientId } = await params; const thread = await getSecureMessages(user.id, patientId); if (!thread) notFound(); return <><PageHeader title={thread.patientName} description="Secure patient conversation. Do not send urgent or emergency information here." /><Section title="Conversation"><div className="space-y-3">{thread.messages.map(m => <article key={m.id} className={m.mine ? "ml-auto max-w-xl rounded-md bg-pine px-4 py-3 text-white" : "max-w-xl rounded-md border border-border bg-white px-4 py-3"}>{m.body}</article>)}</div></Section><Section title="Reply"><MessageComposer patientId={patientId} /></Section></>; }
