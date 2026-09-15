import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

/*
  Button
  ======
  Three variants, three sizes. That is deliberately the whole surface area
  for now - every screen we build should be able to say what it needs
  using these, rather than reaching for a one-off style. If a screen
  needs a fourth variant, that is a sign to add it here, not to write
  custom button styles inline.

  Variants:
    primary   - the one main action on a screen (e.g. "Request care")
    secondary - a supporting action, still important
    ghost     - a low-emphasis action, e.g. inside a dense table row

  Every variant keeps a visible focus ring (from globals.css) and a
  44px minimum touch target on the default size, per the accessibility
  strategy in PHASE_0_ARCHITECTURE.md section 10.
*/

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variantStyles = {
  primary: "bg-pine text-white hover:bg-pine-dark active:bg-pine-dark",
  secondary:
    "bg-white text-ink border border-border-strong hover:bg-sage " +
    "active:bg-sage-dark",
  ghost: "bg-transparent text-ink hover:bg-sage active:bg-sage-dark",
} as const;

const sizeStyles = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-12 px-6 text-base",
} as const;

/**
 * Returns the Button's classes without rendering a <button>. Use this when
 * something needs to LOOK like a button but must render as a different
 * element - most often a Next.js <Link>, since a <button> nested inside
 * or wrapping an <a> is invalid HTML and behaves unreliably.
 *
 * Example: <Link href="/request-care" className={buttonVariants({})}>
 */
export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  className?: string;
} = {}) {
  return cn(baseStyles, variantStyles[variant], sizeStyles[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
