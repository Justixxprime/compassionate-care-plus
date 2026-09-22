import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
  DataTable
  =========
  One table for every list in the internal app. On a wide screen it is a
  real table with a header row. On a phone it becomes a stack of cards, one
  per row, because a table that scrolls sideways is close to unusable
  one-handed (docs/PHASE_0_ARCHITECTURE.md section 10).

  The FIRST column is the row's title: on a phone it is the bold line at the
  top of its card. Every other column shows its header as a small label.

  A column can hold anything, including buttons. Drawing a button here does
  not give it any power: the action behind it re-checks permission and
  reach on the server.

  Server Component. `cell` functions are called while the page is drawn.
*/

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  // Extra classes for this column's cells on a wide screen.
  className?: string;
  // Right-align the column (used for action buttons and numbers).
  alignRight?: boolean;
  // Leave the label off in the phone card (used for an actions column).
  hideLabelOnCard?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  // Read aloud by screen readers to say what the table is. Not drawn.
  caption: string;
  // Drawn instead of the table when there are no rows.
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;

  const [first, ...rest] = columns;

  return (
    <>
      {/* Wide screens: a real table. */}
      <div className="hidden overflow-x-auto rounded-md border border-border bg-white md:block">
        <table className="w-full text-left text-body-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border bg-sage/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-caption font-semibold text-slate",
                    col.alignRight && "text-right",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="align-top">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-ink",
                      col.alignRight && "text-right",
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one card per row. */}
      <ul aria-label={caption} className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-md border border-border bg-white p-4"
          >
            <div className="text-body-sm font-medium text-ink">
              {first.cell(row)}
            </div>
            <dl className="mt-3 space-y-2">
              {rest.map((col) => {
                const content = col.cell(row);
                // A column with nothing in it for this row (no buttons
                // for someone who may not press them) draws nothing.
                if (content === null || content === false || content === undefined) {
                  return null;
                }
                return (
                  <div key={col.key}>
                    {col.hideLabelOnCard ? null : (
                      <dt className="text-caption text-slate">{col.header}</dt>
                    )}
                    <dd className="text-body-sm text-ink">{content}</dd>
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
