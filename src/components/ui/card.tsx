import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/*
  Card
  ====
  A bordered surface for grouping related content - a patient summary,
  a stat block, a settings section.

  Deliberately NOT used as the answer to every layout problem. The
  design brief in PHASE_0_ARCHITECTURE.md warns specifically against
  "three identical cards in a row" as the default structure for every
  page. Use a Card when content genuinely needs a bounded container;
  otherwise a heading and spacing are enough.
*/

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-white p-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-h4 font-display font-semibold text-ink", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-body-sm text-slate", className)} {...props} />
  );
}
