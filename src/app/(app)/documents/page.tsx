import type { Metadata } from "next";
import { FileText } from "lucide-react";
import Link from "next/link";
import { getRequestPermissions, requireUser } from "@/lib/app/access";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  getDocumentUploadOptions,
  listDocuments,
  type DocumentRow,
} from "@/lib/documents";
import { formatOrgDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { UploadDocumentForm } from "./upload-document-form";
import { ArchiveButton } from "./archive-button";

// Document access is permission AND relationship AND category, for
// reading, downloading, filing and archiving; every rule lives in
// src/lib/documents.ts. This screen only draws what that file says the
// person may see and do.

export const metadata: Metadata = { title: "Documents" };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentCard({ doc }: { doc: DocumentRow }) {
  return (
    <li className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{doc.categoryLabel}</Badge>
          {doc.restricted ? <Badge tone="warning">Restricted</Badge> : null}
          {doc.sharedWithYou ? <Badge tone="info">Shared with you</Badge> : null}
          <span className="text-body-sm text-slate">{doc.patientName}</span>
        </div>
        <h3 className="mt-2 text-body font-medium text-ink">{doc.title}</h3>
        <p className="mt-1 text-body-sm text-slate">
          {doc.fileName} &middot; {formatSize(doc.sizeBytes)} &middot; filed by{" "}
          {doc.uploadedByName} on {formatOrgDate(doc.createdAt)}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-2 sm:justify-end">
        {/* A plain link on purpose: a download is a GET request to
            /documents/[id]/download, which checks everything itself. */}
        <a
          href={`/documents/${doc.id}/download`}
          className={buttonVariants({ size: "sm" })}
        >
          Download
        </a>
        {doc.canArchive ? <ArchiveButton documentId={doc.id} /> : null}
      </div>
    </li>
  );
}

export default async function DocumentsPage() {
  const user = await requireUser();

  // listDocuments calls requirePermission first. An account without
  // documents.read gets a plain explanation rather than a crash, and the
  // refusal is already in the audit log by the time this catch runs.
  let documents: DocumentRow[];
  try {
    documents = await listDocuments(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return <NoAccess area="Documents" />;
    throw err;
  }

  const options = await getDocumentUploadOptions(user.id);
  const permissions = await getRequestPermissions(user.id);

  return (
    <>
      <PageHeader
        title="Documents"
        description="You see the documents of the patients you can reach. Insurance and identification documents are restricted on purpose: administrators see them, and anyone else only when an administrator has shared one with them. Every download is written to the audit log."
        actions={
          permissions.has("documents.grant") ? (
            <Link href="/documents/sharing" className={buttonVariants({ size: "md", variant: "secondary" })}>
              Sharing
            </Link>
          ) : undefined
        }
      />

      {options !== null ? (
        <Section title="File a document">
          {options.patients.length === 0 || options.categories.length === 0 ? (
            <EmptyState icon={FileText} title="No patient to file for">
              There is no patient you can file a document for right now.
            </EmptyState>
          ) : (
            <div className="rounded-md border border-border bg-white p-4 sm:p-6">
              <UploadDocumentForm options={options} />
            </div>
          )}
        </Section>
      ) : null}

      <Section title="On file">
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents">
            No documents for this account.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
