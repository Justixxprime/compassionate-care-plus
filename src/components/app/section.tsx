import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
  Section
  =======
  A titled block of a screen: a heading, an optional line of explanation,
  optional actions on the right, and the content. Used for every list and
  form on every internal screen so the spacing and heading size never
  drift from one screen to the next.
*/

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-10", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-h4 font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-body-sm text-slate">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
