import { notFound } from "next/navigation";
import { requireUser } from "@/lib/app/access";
import { getSecureMessages } from "@/lib/secure-messages";
import { formatOrgDate, formatOrgTime } from "@/lib/time";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { MessageComposer } from "../message-composer";

export default async function StaffMessageThreadPage({
  params,
}: PageProps<"/messages/[patientId]">) {
  const user = await requireUser();
  const { patientId } = await params;
  const thread = await getSecureMessages(user.id, patientId);
  if (!thread) notFound();

  return (
    <>
      <PageHeader
        title={thread.patientName}
        description="Secure patient conversation. Do not send urgent or emergency information here."
      />
      <Section title="Conversation">
        <div className="space-y-3">
          {thread.messages.length ? (
            thread.messages.map((message) => (
              <article
                key={message.id}
                className={message.mine
                  ? "ml-auto max-w-xl rounded-md bg-pine px-4 py-3 text-white"
                  : "max-w-xl rounded-md border border-border bg-white px-4 py-3"}
              >
                <p className="text-body">{message.body}</p>
                <p className={message.mine ? "mt-2 text-caption text-white/70" : "mt-2 text-caption text-slate"}>
                  {message.mine ? "You" : message.senderName} · {formatOrgDate(message.createdAt)}, {formatOrgTime(message.createdAt)}
                </p>
              </article>
            ))
          ) : (
            <EmptyState title="No messages yet">
              Send a secure message to begin this conversation.
            </EmptyState>
          )}
        </div>
      </Section>
      <Section title="Reply">
        <MessageComposer patientId={patientId} />
      </Section>
    </>
  );
}
