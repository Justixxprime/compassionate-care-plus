import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

/*
  Input
  =====
  A plain text input styled consistently everywhere it appears - the
  public "Request care" form and the internal application both use this
  same component, so a field looks and behaves the same regardless of
  which portal it is in.

  Error state: pass `aria-invalid="true"` and point `aria-describedby`
  at the id of the error message. That wiring is what lets a screen
  reader announce the error - color alone (a red border) communicates
  nothing to someone who cannot see it.
*/

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink",
        "placeholder:text-slate-light",
        "focus-visible:outline-none", // the shared :focus-visible ring in globals.css still applies
        "disabled:cursor-not-allowed disabled:bg-sage disabled:text-slate",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
