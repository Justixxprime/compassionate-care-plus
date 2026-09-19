import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  getDocumentUploadOptions,
  listDocuments,
  type DocumentRow,
} from "@/lib/documents";
import { formatOrgDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { UploadDocumentForm } from "./upload-document-form";
import { ArchiveButton } from "./archive-button";

// Deliberately plain, like /dashboard, /patients, /visits and
// /care-plans - this exists to prove document access works end to end
// (permission AND relationship AND category, for reading, downloading,
// filing and archiving), not to be the real document centre. That is
// Milestone E.

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentCard({ doc }: { doc: DocumentRow }) {
  return (
    <li className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{doc.categoryLabel}</Badge>
          {doc.restricted ? <Badge tone="warning">Restricted</Badge> : null}
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
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // listDocuments calls requirePermission first. An account without
  // documents.read gets a plain explanation rather than a crash - the
  // denial itself is already in the audit log by the time this catch runs.
  let documents: DocumentRow[];
  try {
    documents = await listDocuments(user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-20">
          <h1 className="font-display text-h1 text-ink">Documents</h1>
          <p className="mt-4 text-body text-slate">
            Your account does not have access to documents.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-block text-body-sm font-medium text-pine hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      );
    }
    throw err;
  }

  const options = await getDocumentUploadOptions(user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-label font-semibold uppercase tracking-[0.2em] text-marigold">
        Documents
      </p>
      <h1 className="mt-3 font-display text-h1 text-ink">Documents you can see</h1>
      <p className="mt-3 max-w-xl text-body text-slate">
        Like everything else here, what you see depends on who is signed in.
        You see the documents of patients you can reach. Insurance and
        identification documents are restricted on purpose: only
        administrative roles can see or file them. Every download is written
        to the audit log.
      </p>

      {options !== null ? (
        <section className="mt-10 rounded-md border border-border bg-white p-6">
          <h2 className="font-display text-h3 text-ink">File a document</h2>
          {options.patients.length === 0 || options.categories.length === 0 ? (
            <p className="mt-3 text-body-sm text-slate">
              There is no patient you can file a document for right now.
            </p>
          ) : (
            <div className="mt-5">
              <UploadDocumentForm options={options} />
            </div>
          )}
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-h3 text-ink">On file</h2>
        {documents.length === 0 ? (
          <p className="mt-4 border-y border-border py-6 text-body-sm text-slate">
            No documents for this account.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12 flex flex-wrap gap-6">
        <Link href="/dashboard" className="text-body-sm font-medium text-pine hover:underline">
          Back to dashboard
        </Link>
        <Link href="/patients" className="text-body-sm font-medium text-pine hover:underline">
          Patients
        </Link>
        <Link href="/visits" className="text-body-sm font-medium text-pine hover:underline">
          Visits
        </Link>
        <Link href="/care-plans" className="text-body-sm font-medium text-pine hover:underline">
          Care plans
        </Link>
      </div>
    </div>
  );
}
