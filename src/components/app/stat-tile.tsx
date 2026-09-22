import Link from "next/link";
import { cn } from "@/lib/cn";

/*
  StatTile
  ========
  One number that matters, with a short line under it and a link to the
  screen that holds the detail. Numbers use tabular figures so a row of
  tiles lines up.
*/

export function StatTile({
  label,
  value,
  hint,
  href,
  className,
}: {
  label: string;
  value: number;
  hint?: string | null;
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-md border border-border bg-white p-4 transition-colors hover:border-pine/50 hover:bg-sage/30",
        className,
      )}
    >
      <p className="text-caption font-medium text-slate">{label}</p>
      <p className="mt-1 font-display text-h1 leading-none tabular-nums text-ink">
        {value}
      </p>
      {hint ? <p className="mt-2 text-caption text-slate">{hint}</p> : null}
    </Link>
  );
}
