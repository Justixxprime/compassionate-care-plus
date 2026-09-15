import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names and resolves Tailwind conflicts sensibly.
 *
 * Why this exists: if a component has a default class of "px-4" and
 * something using it passes "px-6" to override it, plain string
 * concatenation leaves both classes present and the result depends on
 * CSS specificity luck. twMerge understands Tailwind's own classes well
 * enough to keep only the last one that actually applies.
 *
 * Example:
 *   cn("px-4 py-2 bg-pine", isActive && "bg-marigold")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
