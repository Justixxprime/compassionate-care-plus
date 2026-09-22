import { type ReactNode } from "react";

/*
  PageHeader
  ==========
  The title block at the top of every internal screen: one heading, one
  sentence saying what the screen is for, and room on the right for the
  main action. Every screen uses it, so the titles line up wherever you go.
*/

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-h2 text-ink">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-body-sm text-slate">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
