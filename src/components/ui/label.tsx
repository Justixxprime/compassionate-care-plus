import { type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/*
  Label
  =====
  Always paired with a form field via htmlFor/id. A field without a
  linked label is invisible to screen reader users - this is one of
  the most common accessibility mistakes, so I am making it hard to
  skip by giving every field a real Label component from day one.
*/

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-label font-medium text-ink mb-1.5 inline-block",
        className,
      )}
      {...props}
    />
  );
}
