import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/*
  EmptyState
  ==========
  What a list shows when there is nothing in it. Always says what is
  missing and, when there is one, what to do about it. An empty list with
  no words looks like a broken page.
*/

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-border-strong bg-white px-6 py-10 text-center">
      {Icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage">
          <Icon className="h-5 w-5 text-pine" aria-hidden="true" />
        </span>
      ) : null}
      <p className="mt-3 text-body font-medium text-ink">{title}</p>
      {children ? (
        <p className="mt-1 max-w-md text-body-sm text-slate">{children}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
