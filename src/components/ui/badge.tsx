import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/*
  Badge
  =====
  Used for statuses: a visit's status, a referral stage, a document's
  state. IMPORTANT rule from PHASE_0_ARCHITECTURE.md section 10: status
  is always color PLUS text, never color alone. A badge that says
  "Completed" in green tells a colorblind user something; a green dot
  with no label tells them nothing. Every Badge here renders its text.
*/

const toneStyles = {
  neutral: "bg-sage text-ink",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof toneStyles;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-label font-medium",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}
