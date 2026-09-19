"use client";

import { useState, useTransition } from "react";
import { archiveDocumentAction } from "@/lib/documents-actions";
import { buttonVariants } from "@/components/ui/button";

// Drawn only for someone who holds documents.delete (the page decides),
// but archiveDocument re-checks on the server whatever this button says.
export function ArchiveButton({ documentId }: { documentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (
      !window.confirm(
        "Archive this document? It will disappear from every list and download. It is kept on record.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await archiveDocumentAction(documentId);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={buttonVariants({ size: "sm", variant: "secondary" })}
      >
        Archive
      </button>
      {error ? (
        <p role="alert" className="max-w-xs text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
