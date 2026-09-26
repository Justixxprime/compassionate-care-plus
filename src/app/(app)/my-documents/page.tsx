import type { Metadata } from "next";
import { FileText, Info } from "lucide-react";
import { requireUser } from "@/lib/app/access";
import { listMyDocuments } from "@/lib/patient-documents";
import { formatOrgDate } from "@/lib/time";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";

export const metadata: Metadata = { title: "My documents" };

export default async function MyDocumentsPage() {
  const user = await requireUser();
  const documents = await listMyDocuments(user.id);
  return <><PageHeader title="My documents" description="Documents the office has added to your care record. Downloads are private and are not kept in your browser cache." /><Section title="Documents">{documents === null ? <EmptyState icon={Info} title="Your account is not connected to a care record yet">The office connects your account to your record. Please call the office and ask them to do this.</EmptyState> : documents.length ? <div className="divide-y rounded-md border border-border bg-white">{documents.map((document) => <a key={document.id} href={`/my-documents/${document.id}/download`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-sage"><span><span className="block font-medium text-ink">{document.title}</span><span className="text-caption text-slate">{document.categoryLabel} · Added {formatOrgDate(document.createdAt)}</span></span><span className="text-caption font-medium text-pine">Download</span></a>)}</div> : <EmptyState icon={FileText} title="No documents have been added yet">When the office adds a document to your care record, it appears here.</EmptyState>}</Section></>;
}
